import math
import os

from flask import Flask, render_template, request, jsonify, session
import mysql.connector

from config import DB_CONFIG

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY") or os.urandom(32)

def get_db():
    """Restituisce una nuova connessione al database MySQL."""
    return mysql.connector.connect(
        host=DB_CONFIG.get("host", "127.0.0.1"),
        port=DB_CONFIG.get("port", 3306),
        user=DB_CONFIG.get("user", "root"),
        password=DB_CONFIG.get("password", ""),
        database=DB_CONFIG.get("database", "database_mysql"),
        charset=DB_CONFIG.get("charset", "utf8mb4"),
        autocommit=False
    )

def fetch_drinks_with_availability(active_only=True):
    """
    Recupera i drink da MySQL e calcola quante porzioni rimangono
    disponibili in base alla scorta minima degli ingredienti usati.
    """
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        query = "SELECT * FROM drinks"
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY category ASC, name ASC"
        cursor.execute(query)
        drinks = cursor.fetchall()

        cursor.execute("""
            SELECT
                r.drink_id,
                r.ingredient_id,
                r.amount,
                i.name AS ingredient_name,
                i.unit AS ingredient_unit,
                i.stock AS current_stock,
                i.alert_threshold,
                i.cost_per_unit
            FROM recipe_items r
            JOIN ingredients i ON r.ingredient_id = i.id
        """)
        recipe_rows = cursor.fetchall()

        recipes_by_drink = {}
        for row in recipe_rows:
            recipes_by_drink.setdefault(row["drink_id"], []).append(row)

        for drink in drinks:
            drink_id = drink["id"]
            drink["price"] = float(drink["price"])
            recipe = recipes_by_drink.get(drink_id, [])
            drink["recipe"] = recipe

            if not recipe:
                drink["available_count"] = 0
                drink["bottleneck"] = None
                drink["has_recipe"] = False
                drink["cost_of_ingredients"] = 0.0
                drink["margin_profit"] = drink["price"]
                drink["margin_percent"] = 100.0 if drink["price"] > 0 else 0.0
                continue

            drink["has_recipe"] = True
            min_portions = None
            bottleneck = None
            cost_of_ingredients = 0.0

            for item in recipe:
                dose = float(item["amount"])
                stock = float(item["current_stock"])
                cpu = float(item.get("cost_per_unit") or 0.0)
                item["cost_per_unit"] = cpu
                cost_of_ingredients += dose * cpu

                portions = math.floor(stock / dose) if dose > 0 else 9999
                item["can_make"] = max(0, portions)

                if min_portions is None or portions < min_portions:
                    min_portions = portions
                    bottleneck = {
                        "ingredient_id": item["ingredient_id"],
                        "name": item["ingredient_name"],
                        "current_stock": stock,
                        "unit": item["ingredient_unit"],
                        "amount_needed": dose
                    }

            drink["available_count"] = max(0, min_portions if min_portions is not None else 0)
            drink["bottleneck"] = bottleneck
            drink["cost_of_ingredients"] = round(cost_of_ingredients, 2)
            margin_profit = drink["price"] - cost_of_ingredients
            drink["margin_profit"] = round(margin_profit, 2)
            drink["margin_percent"] = round((margin_profit / drink["price"]) * 100, 1) if drink["price"] > 0 else 0.0

        return drinks
    finally:
        cursor.close()
        conn.close()

def create_order_transaction(table_number, staff_name, items, notes=""):
    """
    Inserisce una nuova comanda e scala le dosi di alcol/mixer
    dal magazzino in un'unica transazione sicura.
    """
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        total_ingredient_needed = {}
        drink_details = {}
        order_total = 0.0

        for item in items:
            drink_id = int(item["drink_id"])
            qty = int(item["quantity"])
            if qty <= 0:
                continue

            cursor.execute("SELECT id, name, price, is_active FROM drinks WHERE id = %s", (drink_id,))
            drink = cursor.fetchone()
            if not drink or not drink["is_active"]:
                return False, f"Drink non valido o disattivato (ID: {drink_id})", None

            drink_details[drink_id] = drink
            order_total += float(drink["price"]) * qty

            cursor.execute("""
                SELECT r.ingredient_id, r.amount, i.name AS ing_name, i.stock, i.unit
                FROM recipe_items r
                JOIN ingredients i ON r.ingredient_id = i.id
                WHERE r.drink_id = %s
            """, (drink_id,))
            recipe_items = cursor.fetchall()
            if not recipe_items:
                return False, f"Il drink '{drink['name']}' non ha una ricetta configurata.", None

            for r in recipe_items:
                ing_id = r["ingredient_id"]
                needed = float(r["amount"]) * qty
                if ing_id not in total_ingredient_needed:
                    total_ingredient_needed[ing_id] = {
                        "name": r["ing_name"],
                        "needed": 0.0,
                        "current_stock": float(r["stock"]),
                        "unit": r["unit"]
                    }
                total_ingredient_needed[ing_id]["needed"] += needed

        for req in total_ingredient_needed.values():
            if req["needed"] > req["current_stock"]:
                diff = req["needed"] - req["current_stock"]
                return False, (
                    f"Scorte insufficienti di '{req['name']}'. "
                    f"Disponibili: {req['current_stock']:.1f}{req['unit']}, "
                    f"richiesti: {req['needed']:.1f}{req['unit']} (mancano {diff:.1f}{req['unit']})."
                ), None

        cursor.execute("SELECT COUNT(*) AS count FROM orders")
        order_num = cursor.fetchone()["count"] + 1
        order_code = f"ORD-{order_num:04d}"

        cursor.execute("""
            INSERT INTO orders (order_code, table_number, staff_name, status, total_amount, notes)
            VALUES (%s, %s, %s, 'in_attesa', %s, %s)
        """, (order_code, table_number.strip(), staff_name.strip(), order_total, notes.strip()))
        order_id = cursor.lastrowid

        for item in items:
            drink_id = int(item["drink_id"])
            qty = int(item["quantity"])
            if qty <= 0:
                continue
            d = drink_details[drink_id]
            price = float(d["price"])
            subtotal = price * qty
            cursor.execute("""
                INSERT INTO order_items (order_id, drink_id, quantity, unit_price, subtotal)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, drink_id, qty, price, subtotal))

        for ing_id, req in total_ingredient_needed.items():
            new_stock = req["current_stock"] - req["needed"]
            cursor.execute("UPDATE ingredients SET stock = %s WHERE id = %s", (new_stock, ing_id))
            cursor.execute("""
                INSERT INTO stock_logs (ingredient_id, change_amount, resulting_stock, reason)
                VALUES (%s, %s, %s, %s)
            """, (ing_id, -req["needed"], new_stock, f"Comanda {order_code} (Tavolo {table_number})"))

        conn.commit()
        return True, "Ordine inserito con successo!", {
            "order_id": order_id,
            "order_code": order_code,
            "table_number": table_number,
            "total_amount": order_total
        }
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def cancel_order_transaction(order_id):
    """Annulla la comanda e restituisce le dosi consumate al magazzino."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        if not order:
            return False, "Ordine non trovato."
        if order["status"] == "annullato":
            return False, "L'ordine è già stato annullato in precedenza."

        cursor.execute("SELECT drink_id, quantity FROM order_items WHERE order_id = %s", (order_id,))
        items = cursor.fetchall()

        for item in items:
            drink_id = item["drink_id"]
            qty = item["quantity"]

            cursor.execute("SELECT ingredient_id, amount FROM recipe_items WHERE drink_id = %s", (drink_id,))
            recipe_items = cursor.fetchall()

            for r in recipe_items:
                ing_id = r["ingredient_id"]
                amount_to_restore = float(r["amount"]) * qty

                cursor.execute("SELECT stock FROM ingredients WHERE id = %s", (ing_id,))
                current_stock = float(cursor.fetchone()["stock"])
                new_stock = current_stock + amount_to_restore

                cursor.execute("UPDATE ingredients SET stock = %s WHERE id = %s", (new_stock, ing_id))
                cursor.execute("""
                    INSERT INTO stock_logs (ingredient_id, change_amount, resulting_stock, reason)
                    VALUES (%s, %s, %s, %s)
                """, (ing_id, amount_to_restore, new_stock, f"Ripristino annullamento {order['order_code']}"))

        cursor.execute("UPDATE orders SET status = 'annullato' WHERE id = %s", (order_id,))
        conn.commit()
        return True, "Ordine annullato e materie prime ripristinate in magazzino."
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def edit_order_transaction(order_id, new_items, new_table_number=None, new_notes=None):
    """
    Permette di modificare una comanda già inviata (es. il cliente cambia drink)
    prima che venga servita, calcolando i delta precisi di magazzino.
    """
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        order = cursor.fetchone()
        if not order:
            return False, "Comanda non trovata.", None
        if order["status"] in ("servito", "pagato", "annullato"):
            return False, f"Impossibile modificare l'ordine nello stato '{order['status']}'.", None

        cursor.execute("""
            SELECT oi.drink_id, oi.quantity, ri.ingredient_id, ri.amount, i.name AS ing_name, i.stock, i.unit
            FROM order_items oi
            JOIN recipe_items ri ON oi.drink_id = ri.drink_id
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE oi.order_id = %s
        """, (order_id,))
        old_recipe_rows = cursor.fetchall()

        old_ingredient_usage = {}
        for r in old_recipe_rows:
            ing_id = r["ingredient_id"]
            old_ingredient_usage[ing_id] = old_ingredient_usage.get(ing_id, 0.0) + float(r["amount"]) * int(r["quantity"])

        new_ingredient_usage = {}
        new_drink_details = {}
        new_total_amount = 0.0

        for item in new_items:
            drink_id = int(item["drink_id"])
            qty = int(item["quantity"])
            if qty <= 0:
                continue

            cursor.execute("SELECT id, name, price, is_active FROM drinks WHERE id = %s", (drink_id,))
            drink = cursor.fetchone()
            if not drink:
                return False, f"Drink non trovato (ID {drink_id})", None

            new_drink_details[drink_id] = drink
            new_total_amount += float(drink["price"]) * qty

            cursor.execute("""
                SELECT ri.ingredient_id, ri.amount, i.name AS ing_name, i.stock, i.unit
                FROM recipe_items ri
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.drink_id = %s
            """, (drink_id,))
            ri_rows = cursor.fetchall()
            for r in ri_rows:
                ing_id = r["ingredient_id"]
                needed = float(r["amount"]) * qty
                new_ingredient_usage[ing_id] = new_ingredient_usage.get(ing_id, 0.0) + needed

        all_ing_ids = set(old_ingredient_usage.keys()).union(new_ingredient_usage.keys())
        deltas = {}

        for ing_id in all_ing_ids:
            cursor.execute("SELECT id, name, stock, unit FROM ingredients WHERE id = %s FOR UPDATE", (ing_id,))
            ing_info = cursor.fetchone()
            if not ing_info:
                continue

            old_used = old_ingredient_usage.get(ing_id, 0.0)
            new_used = new_ingredient_usage.get(ing_id, 0.0)
            delta = new_used - old_used
            deltas[ing_id] = {
                "name": ing_info["name"],
                "delta": delta,
                "current_stock": float(ing_info["stock"]),
                "unit": ing_info["unit"]
            }

            if delta > 0 and delta > float(ing_info["stock"]):
                diff = delta - float(ing_info["stock"])
                return False, f"Scorte insufficienti di '{ing_info['name']}' per la sostituzione (mancano {diff:.1f}{ing_info['unit']}).", None

        table_num = new_table_number.strip() if new_table_number else order["table_number"]
        notes_val = new_notes.strip() if new_notes is not None else order["notes"]

        cursor.execute("""
            UPDATE orders
            SET total_amount = %s, table_number = %s, notes = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (new_total_amount, table_num, notes_val, order_id))

        cursor.execute("DELETE FROM order_items WHERE order_id = %s", (order_id,))
        for item in new_items:
            drink_id = int(item["drink_id"])
            qty = int(item["quantity"])
            if qty <= 0:
                continue
            d = new_drink_details[drink_id]
            price = float(d["price"])
            subtotal = price * qty
            cursor.execute("""
                INSERT INTO order_items (order_id, drink_id, quantity, unit_price, subtotal)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, drink_id, qty, price, subtotal))

        for ing_id, info in deltas.items():
            delta = info["delta"]
            if abs(delta) > 0.001:
                new_stock = info["current_stock"] - delta
                cursor.execute("UPDATE ingredients SET stock = %s WHERE id = %s", (new_stock, ing_id))
                reason_text = f"Modifica comanda {order['order_code']} (Tavolo {table_num})"
                cursor.execute("""
                    INSERT INTO stock_logs (ingredient_id, change_amount, resulting_stock, reason)
                    VALUES (%s, %s, %s, %s)
                """, (ing_id, -delta, new_stock, reason_text))

        conn.commit()
        return True, f"Comanda {order['order_code']} modificata con successo!", {
            "order_id": order_id,
            "order_code": order["order_code"],
            "table_number": table_num,
            "total_amount": new_total_amount
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def fetch_orders_queue(status_filter=None):
    """Restituisce le comande con i dettagli dei drink e la ricetta per il barman."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        query = "SELECT * FROM orders"
        params = []
        if status_filter:
            if isinstance(status_filter, list):
                placeholders = ",".join(["%s"] * len(status_filter))
                query += f" WHERE status IN ({placeholders})"
                params.extend(status_filter)
            else:
                query += " WHERE status = %s"
                params.append(status_filter)

        query += """
            ORDER BY
                CASE status
                    WHEN 'in_attesa' THEN 1
                    WHEN 'in_preparazione' THEN 2
                    WHEN 'servito' THEN 3
                    ELSE 4
                END,
                created_at DESC
        """
        cursor.execute(query, tuple(params) if params else None)
        orders = cursor.fetchall()

        for order in orders:
            order["total_amount"] = float(order["total_amount"])
            cursor.execute("""
                SELECT oi.quantity, oi.unit_price, oi.subtotal, d.id AS drink_id, d.name AS drink_name, d.category
                FROM order_items oi
                JOIN drinks d ON oi.drink_id = d.id
                WHERE oi.order_id = %s
            """, (order["id"],))
            items = cursor.fetchall()

            for item in items:
                item["unit_price"] = float(item["unit_price"])
                item["subtotal"] = float(item["subtotal"])
                cursor.execute("""
                    SELECT i.name AS ing_name, r.amount, i.unit
                    FROM recipe_items r
                    JOIN ingredients i ON r.ingredient_id = i.id
                    WHERE r.drink_id = %s
                """, (item["drink_id"],))
                item["recipe"] = cursor.fetchall()

            order["items"] = items

        return orders
    finally:
        cursor.close()
        conn.close()

@app.errorhandler(500)
def handle_internal_error(error):
    if request.path.startswith("/api/"):
        return jsonify({
            "success": False,
            "message": "Errore del database o del server. Controlla che MySQL sia attivo."
        }), 500
    return "Errore interno del server", 500

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/auth/verify-pin", methods=["POST"])
def verify_pin():
    data = request.get_json(silent=True) or {}
    pin = str(data.get("pin", "")).strip()

    if not pin:
        return jsonify({"success": False, "message": "Inserisci il PIN di sicurezza."}), 400

    stored_pin = "1234"
    db_ok = True

    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT value FROM settings WHERE `key` = 'owner_pin'")
            row = cursor.fetchone()
            if row and row.get("value"):
                stored_pin = str(row["value"]).strip()
        finally:
            cursor.close()
            conn.close()
    except Exception as e:

        db_ok = False
        print(f"[WARN verify_pin] DB non raggiungibile ({e}), uso PIN master '1234'")

    if pin == stored_pin:
        session["role"] = "titolare"
        msg = "Accesso Titolare confermato!"
        if not db_ok:
            msg += " (Avviso: MySQL non risponde, verifica config.py)"
        return jsonify({
            "success": True,
            "message": msg,
            "role": "titolare",
            "db_connected": db_ok
        })

    return jsonify({"success": False, "message": "PIN errato! Riprova con il PIN corretto (Default: 1234)."}), 401

@app.route("/api/auth/change-pin", methods=["POST"])
def change_pin():
    data = request.get_json(silent=True) or {}
    old_pin = str(data.get("old_pin", "")).strip()
    new_pin = str(data.get("new_pin", "")).strip()

    if len(new_pin) < 4:
        return jsonify({"success": False, "message": "Il nuovo PIN deve contenere almeno 4 cifre."}), 400

    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT value FROM settings WHERE `key` = 'owner_pin'")
            row = cursor.fetchone()
            stored_pin = row["value"] if row else "1234"

            if old_pin != stored_pin:
                return jsonify({"success": False, "message": "Il vecchio PIN non è corretto."}), 401

            cursor.execute("UPDATE settings SET value = %s WHERE `key` = 'owner_pin'", (new_pin,))
            conn.commit()
            return jsonify({"success": True, "message": "PIN aggiornato con successo!"})
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        return jsonify({"success": False, "message": f"Impossibile aggiornare il PIN nel database ({e})"}), 500

@app.route("/api/ingredients", methods=["GET"])
def get_ingredients():
    low_stock_only = request.args.get("low_stock") == "true"
    status_filter = request.args.get("status")

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        if low_stock_only or status_filter == "low_stock":
            cursor.execute("""
                SELECT id, name, category, unit, stock, alert_threshold, cost_per_unit, updated_at
                FROM ingredients
                WHERE stock <= alert_threshold
                ORDER BY stock ASC, name ASC
            """)
        elif status_filter == "esaurito":
            cursor.execute("""
                SELECT id, name, category, unit, stock, alert_threshold, cost_per_unit, updated_at
                FROM ingredients
                WHERE stock <= 0
                ORDER BY name ASC
            """)
        else:
            cursor.execute("""
                SELECT id, name, category, unit, stock, alert_threshold, cost_per_unit, updated_at
                FROM ingredients
                ORDER BY category ASC, name ASC
            """)

        ingredients = cursor.fetchall()
        for ing in ingredients:
            ing["stock"] = float(ing["stock"])
            ing["alert_threshold"] = float(ing["alert_threshold"])
            ing["cost_per_unit"] = float(ing["cost_per_unit"])
            if ing["stock"] <= 0:
                ing["stock_status"] = "danger"
            elif ing["stock"] <= ing["alert_threshold"]:
                ing["stock_status"] = "warning"
            else:
                ing["stock_status"] = "ok"

        return jsonify({
            "success": True,
            "ingredients": ingredients,
            "is_filtered_low_stock": bool(low_stock_only or status_filter == "low_stock")
        })
    finally:
        cursor.close()
        conn.close()

@app.route("/api/ingredients", methods=["POST"])
def create_ingredient():
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "Altro")).strip()
    unit = str(data.get("unit", "ml")).strip()
    stock = float(data.get("stock", 0.0))
    alert_threshold = float(data.get("alert_threshold", 200.0))
    cost_per_unit = float(data.get("cost_per_unit", 0.0))

    if not name:
        return jsonify({"success": False, "message": "Il nome dell'ingrediente è obbligatorio."}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO ingredients (name, category, unit, stock, alert_threshold, cost_per_unit)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (name, category, unit, stock, alert_threshold, cost_per_unit))
        ing_id = cursor.lastrowid

        if stock > 0:
            cursor.execute("""
                INSERT INTO stock_logs (ingredient_id, change_amount, resulting_stock, reason)
                VALUES (%s, %s, %s, 'Giacenza iniziale')
            """, (ing_id, stock, stock))

        conn.commit()
        return jsonify({"success": True, "message": f"Materia prima '{name}' aggiunta!", "id": ing_id})
    except mysql.connector.Error as e:
        conn.rollback()
        if e.errno == 1062:
            return jsonify({"success": False, "message": "Un ingrediente con questo nome esiste già."}), 400
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/ingredients/<int:ing_id>", methods=["PUT"])
def update_ingredient(ing_id):
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "Altro")).strip()
    unit = str(data.get("unit", "ml")).strip()
    new_stock = float(data.get("stock", 0.0))
    alert_threshold = float(data.get("alert_threshold", 200.0))
    cost_per_unit = float(data.get("cost_per_unit", 0.0))

    if not name:
        return jsonify({"success": False, "message": "Il nome dell'ingrediente è obbligatorio."}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT stock FROM ingredients WHERE id = %s", (ing_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "Ingrediente non trovato."}), 404

        old_stock = float(row["stock"])
        diff = new_stock - old_stock

        cursor.execute("""
            UPDATE ingredients
            SET name = %s, category = %s, unit = %s, stock = %s, alert_threshold = %s, cost_per_unit = %s
            WHERE id = %s
        """, (name, category, unit, new_stock, alert_threshold, cost_per_unit, ing_id))

        if abs(diff) > 0.001:
            cursor.execute("""
                INSERT INTO stock_logs (ingredient_id, change_amount, resulting_stock, reason)
                VALUES (%s, %s, %s, 'Rettifica manuale inventario')
            """, (ing_id, diff, new_stock))

        conn.commit()
        return jsonify({"success": True, "message": "Materia prima aggiornata con successo!"})
    except mysql.connector.Error as e:
        conn.rollback()
        if e.errno == 1062:
            return jsonify({"success": False, "message": "Un altro ingrediente ha già questo nome."}), 400
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/ingredients/<int:ing_id>/restock", methods=["POST"])
def restock_ingredient(ing_id):
    data = request.get_json() or {}
    amount_to_add = float(data.get("amount", 0.0))
    reason = str(data.get("reason", "Carico fornitore")).strip()

    if amount_to_add <= 0:
        return jsonify({"success": False, "message": "La quantità deve essere maggiore di zero."}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT name, stock, unit FROM ingredients WHERE id = %s", (ing_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "Ingrediente non trovato."}), 404

        new_stock = float(row["stock"]) + amount_to_add
        cursor.execute("UPDATE ingredients SET stock = %s WHERE id = %s", (new_stock, ing_id))
        cursor.execute("""
            INSERT INTO stock_logs (ingredient_id, change_amount, resulting_stock, reason)
            VALUES (%s, %s, %s, %s)
        """, (ing_id, amount_to_add, new_stock, f"{reason} (+{amount_to_add}{row['unit']})"))

        conn.commit()
        return jsonify({
            "success": True,
            "message": f"Aggiunti {amount_to_add} {row['unit']} a '{row['name']}'!",
            "new_stock": new_stock
        })
    finally:
        cursor.close()
        conn.close()

@app.route("/api/ingredients/<int:ing_id>", methods=["DELETE"])
def delete_ingredient(ing_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT d.name FROM recipe_items r
            JOIN drinks d ON r.drink_id = d.id
            WHERE r.ingredient_id = %s
        """, (ing_id,))
        used_in = [r["name"] for r in cursor.fetchall()]

        if used_in:
            return jsonify({
                "success": False,
                "message": f"Impossibile eliminare: ingrediente usato nei drink: {', '.join(used_in)}."
            }), 400

        cursor.execute("DELETE FROM ingredients WHERE id = %s", (ing_id,))
        conn.commit()
        return jsonify({"success": True, "message": "Materia prima eliminata con successo!"})
    finally:
        cursor.close()
        conn.close()

@app.route("/api/stock-logs", methods=["GET"])
def get_stock_logs():
    limit = int(request.args.get("limit", 50))
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT l.id, l.change_amount, l.resulting_stock, l.reason, l.created_at,
                   i.name AS ingredient_name, i.unit
            FROM stock_logs l
            JOIN ingredients i ON l.ingredient_id = i.id
            ORDER BY l.id DESC
            LIMIT %s
        """, (limit,))
        logs = cursor.fetchall()
        for log in logs:
            log["change_amount"] = float(log["change_amount"])
            log["resulting_stock"] = float(log["resulting_stock"])
        return jsonify({"success": True, "logs": logs})
    finally:
        cursor.close()
        conn.close()

@app.route("/api/drinks", methods=["GET"])
def get_drinks():
    active_only = request.args.get("all") != "true"
    drinks = fetch_drinks_with_availability(active_only=active_only)
    return jsonify({"success": True, "drinks": drinks})

@app.route("/api/drinks", methods=["POST"])
def create_drink():
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "Cocktail")).strip()
    price = float(data.get("price", 0.0))
    description = str(data.get("description", "")).strip()
    recipe = data.get("recipe", [])

    if not name:
        return jsonify({"success": False, "message": "Il nome del drink è obbligatorio."}), 400
    if not recipe:
        return jsonify({"success": False, "message": "Inserisci almeno un ingrediente per la ricetta."}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO drinks (name, category, price, description)
            VALUES (%s, %s, %s, %s)
        """, (name, category, price, description))
        drink_id = cursor.lastrowid

        for item in recipe:
            ing_id = int(item["ingredient_id"])
            amount = float(item["amount"])
            if amount > 0:
                cursor.execute("""
                    INSERT INTO recipe_items (drink_id, ingredient_id, amount)
                    VALUES (%s, %s, %s)
                """, (drink_id, ing_id, amount))

        conn.commit()
        return jsonify({"success": True, "message": f"Drink '{name}' creato con successo!", "id": drink_id})
    except mysql.connector.Error as e:
        conn.rollback()
        if e.errno == 1062:
            return jsonify({"success": False, "message": "Un drink con questo nome esiste già."}), 400
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/drinks/<int:drink_id>", methods=["PUT"])
def update_drink(drink_id):
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "Cocktail")).strip()
    price = float(data.get("price", 0.0))
    description = str(data.get("description", "")).strip()
    is_active = 1 if data.get("is_active", True) else 0
    recipe = data.get("recipe", [])

    if not name:
        return jsonify({"success": False, "message": "Il nome del drink è obbligatorio."}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE drinks
            SET name = %s, category = %s, price = %s, description = %s, is_active = %s
            WHERE id = %s
        """, (name, category, price, description, is_active, drink_id))

        if recipe is not None:
            cursor.execute("DELETE FROM recipe_items WHERE drink_id = %s", (drink_id,))
            for item in recipe:
                ing_id = int(item["ingredient_id"])
                amount = float(item["amount"])
                if amount > 0:
                    cursor.execute("""
                        INSERT INTO recipe_items (drink_id, ingredient_id, amount)
                        VALUES (%s, %s, %s)
                    """, (drink_id, ing_id, amount))

        conn.commit()
        return jsonify({"success": True, "message": f"Drink '{name}' aggiornato!"})
    except mysql.connector.Error as e:
        conn.rollback()
        if e.errno == 1062:
            return jsonify({"success": False, "message": "Un altro drink usa già questo nome."}), 400
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/drinks/custom", methods=["POST"])
def create_custom_drink():
    """
    Crea un drink fuori menu / personalizzato e restituisce l'oggetto completo
    con dosi e costo materie prime, pronto per essere inserito nella comanda.
    """
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "Fuori Menu")).strip() or "Fuori Menu"
    price = float(data.get("price", 0.0))
    description = str(data.get("description", "Drink personalizzato fuori menu")).strip()
    recipe = data.get("recipe", [])

    if not name:
        return jsonify({"success": False, "message": "Inserisci il nome del drink personalizzato."}), 400
    if price < 0:
        return jsonify({"success": False, "message": "Il prezzo non può essere negativo."}), 400
    if not recipe:
        return jsonify({"success": False, "message": "Seleziona almeno un ingrediente per la ricetta."}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM drinks WHERE name = %s", (name,))
        existing = cursor.fetchone()
        if existing:
            drink_id = existing["id"]
            cursor.execute("""
                UPDATE drinks
                SET category = %s, price = %s, description = %s, is_active = 1
                WHERE id = %s
            """, (category, price, description, drink_id))
            cursor.execute("DELETE FROM recipe_items WHERE drink_id = %s", (drink_id,))
        else:
            cursor.execute("""
                INSERT INTO drinks (name, category, price, description, is_active)
                VALUES (%s, %s, %s, %s, 1)
            """, (name, category, price, description))
            drink_id = cursor.lastrowid

        cost_of_ingredients = 0.0
        recipe_saved = []
        for item in recipe:
            ing_id = int(item["ingredient_id"])
            amount = float(item["amount"])
            if amount > 0:
                cursor.execute("""
                    INSERT INTO recipe_items (drink_id, ingredient_id, amount)
                    VALUES (%s, %s, %s)
                """, (drink_id, ing_id, amount))
                cursor.execute("SELECT name, unit, cost_per_unit, stock FROM ingredients WHERE id = %s", (ing_id,))
                ing_row = cursor.fetchone()
                if ing_row:
                    cpu = float(ing_row["cost_per_unit"] or 0.0)
                    cost_of_ingredients += amount * cpu
                    recipe_saved.append({
                        "ingredient_id": ing_id,
                        "ingredient_name": ing_row["name"],
                        "ingredient_unit": ing_row["unit"],
                        "amount": amount,
                        "cost_per_unit": cpu,
                        "current_stock": float(ing_row["stock"])
                    })

        conn.commit()

        margin_profit = price - cost_of_ingredients
        margin_percent = round((margin_profit / price * 100), 1) if price > 0 else 0.0

        drink_data = {
            "id": drink_id,
            "name": name,
            "category": category,
            "price": price,
            "description": description,
            "recipe": recipe_saved,
            "has_recipe": True,
            "cost_of_ingredients": round(cost_of_ingredients, 2),
            "margin_profit": round(margin_profit, 2),
            "margin_percent": margin_percent,
            "available_count": 999
        }

        return jsonify({
            "success": True,
            "message": f"Drink fuori menu '{name}' creato con successo!",
            "drink": drink_data
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/drinks/<int:drink_id>", methods=["DELETE"])
def delete_drink(drink_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) AS count FROM order_items WHERE drink_id = %s", (drink_id,))
        if cursor.fetchone()["count"] > 0:
            cursor.execute("UPDATE drinks SET is_active = 0 WHERE id = %s", (drink_id,))
            conn.commit()
            return jsonify({"success": True, "message": "Drink archiviato dal menu (presente in vecchi ordini)."})

        cursor.execute("DELETE FROM drinks WHERE id = %s", (drink_id,))
        conn.commit()
        return jsonify({"success": True, "message": "Drink eliminato con successo!"})
    finally:
        cursor.close()
        conn.close()

@app.route("/api/orders", methods=["GET"])
def get_orders():
    status_filter = request.args.get("status")
    if status_filter == "attivi":
        orders = fetch_orders_queue(status_filter=["in_attesa", "in_preparazione"])
    elif status_filter:
        orders = fetch_orders_queue(status_filter=status_filter)
    else:
        orders = fetch_orders_queue()
    return jsonify({"success": True, "orders": orders})

@app.route("/api/orders", methods=["POST"])
def create_order():
    data = request.get_json() or {}
    table_number = str(data.get("table_number", "")).strip()
    staff_name = str(data.get("staff_name", "Cameriere")).strip()
    items = data.get("items", [])
    notes = str(data.get("notes", "")).strip()

    if not table_number:
        return jsonify({"success": False, "message": "Inserisci il numero di tavolo!"}), 400
    if not items:
        return jsonify({"success": False, "message": "Seleziona almeno un drink per l'ordine."}), 400

    success, message, order_info = create_order_transaction(table_number, staff_name, items, notes)
    if not success:
        return jsonify({"success": False, "message": message}), 400

    return jsonify({"success": True, "message": message, "order": order_info})

@app.route("/api/orders/<int:order_id>", methods=["PUT"])
def update_order(order_id):
    """
    Modifica una comanda esistente (es. il cliente desidera cambiare drink prima della preparazione).
    """
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    table_number = data.get("table_number")
    notes = data.get("notes")

    if not items:
        return jsonify({"success": False, "message": "La comanda deve contenere almeno un drink."}), 400

    try:
        success, message, info = edit_order_transaction(order_id, items, table_number, notes)
        if not success:
            return jsonify({"success": False, "message": message}), 400
        return jsonify({"success": True, "message": message, "order": info})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/orders/<int:order_id>/status", methods=["PUT"])
def update_status(order_id):
    data = request.get_json() or {}
    new_status = str(data.get("status", "")).strip()

    valid_statuses = ["in_attesa", "in_preparazione", "servito", "pagato", "annullato"]
    if new_status not in valid_statuses:
        return jsonify({"success": False, "message": "Stato non valido."}), 400

    if new_status == "annullato":
        success, message = cancel_order_transaction(order_id)
        if not success:
            return jsonify({"success": False, "message": message}), 400
        return jsonify({"success": True, "message": message})

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE orders SET status = %s WHERE id = %s", (new_status, order_id))
        conn.commit()
        return jsonify({"success": True, "message": f"Stato aggiornato a '{new_status}'"})
    finally:
        cursor.close()
        conn.close()

@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_revenue
            FROM orders
            WHERE status != 'annullato'
        """)
        overall = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS today_orders, COALESCE(SUM(total_amount), 0) AS today_revenue
            FROM orders
            WHERE status != 'annullato' AND DATE(created_at) = CURDATE()
        """)
        today = cursor.fetchone()

        cursor.execute("SELECT COUNT(*) AS count FROM orders WHERE status IN ('in_attesa', 'in_preparazione')")
        pending_count = cursor.fetchone()["count"]

        cursor.execute("""
            SELECT id, name, unit, stock, alert_threshold
            FROM ingredients
            WHERE stock <= alert_threshold
            ORDER BY stock ASC
        """)
        low_stock_items = cursor.fetchall()
        for it in low_stock_items:
            it["stock"] = float(it["stock"])
            it["alert_threshold"] = float(it["alert_threshold"])

        cursor.execute("""
            SELECT d.name, SUM(oi.quantity) AS sold_count, SUM(oi.subtotal) AS total_earned
            FROM order_items oi
            JOIN drinks d ON oi.drink_id = d.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status != 'annullato'
            GROUP BY d.id, d.name
            ORDER BY sold_count DESC
            LIMIT 5
        """)
        top_drinks = cursor.fetchall()
        for td in top_drinks:
            td["sold_count"] = int(td["sold_count"])
            td["total_earned"] = float(td["total_earned"])

        cursor.execute("SELECT SUM(stock * cost_per_unit) AS stock_value FROM ingredients WHERE stock > 0")
        stock_val_row = cursor.fetchone()
        stock_value = float(stock_val_row["stock_value"]) if stock_val_row and stock_val_row["stock_value"] else 0.0

        cursor.execute("""
            SELECT COALESCE(SUM(oi.quantity * ri.amount * i.cost_per_unit), 0) AS total_cost_served
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN recipe_items ri ON oi.drink_id = ri.drink_id
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE o.status != 'annullato'
        """)
        cost_row = cursor.fetchone()
        total_cost_served = float(cost_row["total_cost_served"]) if cost_row else 0.0

        cursor.execute("""
            SELECT COALESCE(SUM(oi.quantity * ri.amount * i.cost_per_unit), 0) AS today_cost_served
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN recipe_items ri ON oi.drink_id = ri.drink_id
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE o.status != 'annullato' AND DATE(o.created_at) = CURDATE()
        """)
        today_cost_row = cursor.fetchone()
        today_cost_served = float(today_cost_row["today_cost_served"]) if today_cost_row else 0.0

        total_rev = float(overall["total_revenue"])
        today_rev = float(today["today_revenue"])
        total_profit = max(0.0, total_rev - total_cost_served)
        today_profit = max(0.0, today_rev - today_cost_served)
        today_margin_pct = round((today_profit / today_rev * 100), 1) if today_rev > 0 else 0.0

        return jsonify({
            "success": True,
            "stats": {
                "total_orders": int(overall["total_orders"]),
                "total_revenue": round(total_rev, 2),
                "today_orders": int(today["today_orders"]),
                "today_revenue": round(today_rev, 2),
                "total_cost_served": round(total_cost_served, 2),
                "total_profit": round(total_profit, 2),
                "today_cost_served": round(today_cost_served, 2),
                "today_profit": round(today_profit, 2),
                "today_margin_pct": today_margin_pct,
                "pending_orders": int(pending_count),
                "low_stock_count": len(low_stock_items),
                "low_stock_items": low_stock_items,
                "top_drinks": top_drinks,
                "stock_value": round(stock_value, 2)
            }
        })
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    print("Avvio BarMaster su http://127.0.0.1:5001")
    app.run(host="127.0.0.1", port=5001, debug=False)
