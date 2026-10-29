#!/usr/bin/env python3
"""Carica nel database gli ingredienti e i drink di esempio."""

import sys
from pathlib import Path

current_dir = Path(__file__).resolve().parent
project_dir = current_dir.parent
if str(project_dir) not in sys.path:
    sys.path.insert(0, str(project_dir))

try:
    import mysql.connector
    from config import DB_CONFIG
except ImportError as e:
    print(f"\n[ERRORE] Libreria mancante o configurazione non trovata: {e}")
    print("Assicurati di aver attivato il virtualenv e installato i requisiti:")
    print("pip install -r requirements.txt\n")
    sys.exit(1)

def get_connection(cfg):
    """Connette a MySQL e chiede la password se quella configurata non funziona."""
    connect_cfg = dict(cfg)

    try:
        no_db_cfg = {k: v for k, v in connect_cfg.items() if k != "database"}
        conn = mysql.connector.connect(**no_db_cfg)
        return conn, connect_cfg
    except mysql.connector.Error as err:
        if err.errno == 1045:
            print(
                f"\nAccesso negato per l'utente "
                f"'{connect_cfg.get('user', 'root')}'."
            )
            try:
                import getpass

                pwd = getpass.getpass("Password MySQL: ")
            except Exception:
                pwd = input("Password MySQL: ")

            connect_cfg["password"] = pwd
            no_db_cfg["password"] = pwd

            try:
                conn = mysql.connector.connect(**no_db_cfg)
                print("Connessione riuscita.")
                return conn, connect_cfg
            except mysql.connector.Error as err2:
                print(f"\n❌ [ERRORE DI CONNESSIONE]: {err2}")
                print("Verifica la password del tuo utente MySQL ed esegui nuovamente lo script.")
                sys.exit(1)
        else:
            print(f"\n❌ [ERRORE DI CONNESSIONE MYSQL]: {err}")
            print("\nSuggerimenti:")
            print("1. Verifica che il server MySQL sia avviato sul tuo Mac.")
            print("2. Se usi MySQL Workbench, controlla quale porta e utente stai utilizzando.")
            sys.exit(1)

def main():
    print("=" * 65)
    print("🍸 BARMASTER PRO — CARICAMENTO PACCHETTO ESEMPI NEL DATABASE")
    print("=" * 65)
    print(f"Server MySQL : {DB_CONFIG.get('host')}:{DB_CONFIG.get('port')}")
    print(f"Utente       : {DB_CONFIG.get('user')}")
    print(f"Database     : {DB_CONFIG.get('database')}")
    print("-" * 65)

    sql_file_path = current_dir / "popola_db_esempi.sql"
    if not sql_file_path.exists():
        print(f"[ERRORE] File SQL non trovato: {sql_file_path}")
        sys.exit(1)

    conn, active_cfg = get_connection(DB_CONFIG)
    cursor = conn.cursor()

    try:
        db_name = active_cfg.get("database", "database_mysql")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.execute(f"USE `{db_name}`")

        print("\n⏳ Lettura ed esecuzione del file SQL con alcolici e ricette...")
        with open(sql_file_path, "r", encoding="utf-8") as f:
            sql_script = f.read()

        for statement in sql_script.split(";"):
            stmt = statement.strip()
            if stmt:
                cursor.execute(stmt)

        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM ingredients")
        tot_ingredients = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM drinks")
        tot_drinks = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM recipe_items")
        tot_recipes = cursor.fetchone()[0]

        cursor.close()
        conn.close()

        print("=" * 65)
        print("Dati di esempio caricati.")
        print("=" * 65)
        print(f"📦 Materie Prime / Alcolici nel Magazzino : {tot_ingredients}")
        print(f"🍹 Drink e Cocktail nel Menu            : {tot_drinks}")
        print(f"📋 Dosi e Ingredienti nelle Ricette     : {tot_recipes}")
        print("-" * 65)
        print("💡 Ora puoi avviare l'applicazione con:")
        print("   python3 app.py")
        print("   e aprire nel browser http://127.0.0.1:5001")
        print("=" * 65 + "\n")

    except mysql.connector.Error as err:
        print(f"\n[ERRORE DURANTE IL CARICAMENTO]: {err}")
        conn.rollback()
        sys.exit(1)

if __name__ == "__main__":
    main()
