# 🍸 BarMaster PRO

> **Gestionale completo per Bar, Cocktail Bar e Lounge Pub.**  
> Sviluppato con **Python (Flask)**, **MySQL** e interfaccia responsive moderna in **HTML5, CSS3 e JavaScript Vanilla**.

---

## 🌟 Funzionalità Principali

### 📋 1. Coda Ordini & KDS (Kitchen/Bar Display System)
- **Inserimento comande intuitivo**: selezione rapida dal menu con suddivisione per categorie (Aperitivi, Cocktail All Day, After Dinner, Analcolici, Birre & Altro).
- **Tracciamento stati comanda in tempo reale**: *In Attesa*, *In Preparazione*, *Pronto*, *Consegnato*, *Pagato*.
- **Modifica Comande Successiva**: se il cliente cambia idea prima che il drink venga preparato, è possibile **modificare la comanda** sostituendo i drink o variandone le quantità; il magazzino provvede **automaticamente a stornare e riscalare le dosi corrette**.

### 🍹 2. Drink Fuori Menu & Personalizzati
- **Pulsante "+ Drink Fuori Menu"**: consente di comporre un cocktail personalizzato al volo scegliendo gli ingredienti e le dosi.
- **Calcolo istantaneo del Food Cost**: durante la composizione del drink personalizzato, il sistema calcola in tempo reale il costo vivo degli ingredienti, il prezzo consigliato e il guadagno stimato prima di aggiungerlo alla comanda.

### 💰 3. Controllo Costi, Prezzi Materie Prime & Margini
- **Costo delle bottiglie**: inserimento prezzo d'acquisto fornitore e volume per ogni bottiglia (es. 18,50 € per 700 ml), con calcolo automatico del costo a ml/dose.
- **Margine per Drink**: visualizzazione immediata sul menu e nel pannello titolare del margine netto in percentuale (**%**) e in valore assoluto (**€**) per ogni singolo cocktail.
- **Reportistica & Cassa**: storico vendite, incassi totali, drink più venduti e marginalità complessiva.

### 📦 4. Magazzino Intelligente & Giacenze Real-time
- **Disponibilità stimata automatica**: calcolo istantaneo di quanti cocktail possono essere ancora serviti per ciascuna ricetta in base alle scorte rimaste in magazzino.
- **Carichi merce e registro movimenti**: storico completo di tutti i carichi, scarichi ed erogazioni con timestamp e causale.
- **Allarmi sottoscorta**: evidenziazione visiva immediata degli ingredienti vicini all'esaurimento.

### 🔐 5. Area Titolare Protetta da PIN
- **Accesso sicuro**: tastierino numerico a schermo o digitazione da tastiera per sbloccare l'area gestionale (PIN iniziale predefinito: `1234`, modificabile in qualunque momento dal pannello impostazioni).
- Gestione anagrafica ingredienti, inserimento nuove ricette, modifica prezzi e consultazione dati economici.

### 🎨 6. Switch Temi & Palette Grafiche
- **Doppia interfaccia grafica**: possibilità di passare istantaneamente dal sofisticato tema scuro **Dark Cobalt Lounge** (con moderni accenti blu zaffiro ed elettrico) al tema chiaro **Azzurro & Bianco**.
- Memorizzazione persistente della scelta grafica sul browser tramite `localStorage`.

---

## 📁 Struttura del Progetto

```text
GESTIONALE BAR/
├── app.py                      # Backend Flask, routing e logica transazionale MySQL
├── config.py                   # Configurazione database MySQL (senza credenziali sensibili)
├── config.example.py           # File modello per la configurazione
├── config_local.py             # (Ignorato da Git) Credenziali locali del tuo ambiente
├── database_mysql.sql          # Schema DDL del database relazionale (tabelle, indici e vincoli)
├── avvia_gestionale.command    # Script macOS per avvio rapido con doppio clic
├── requirements.txt            # Dipendenze Python necessarie
├── README.md                   # Documentazione completa del progetto
├── static/
│   ├── css/
│   │   └── style.css           # Fogli di stile con supporto variabili CSS e temi (Dark / Azzurro)
│   └── js/
│       └── app.js              # Logica frontend (KDS, carrello, modali, calcoli food cost)
├── templates/
│   └── index.html              # Template Single-Page Application responsive
└── esempi/
    ├── README_ESEMPI.md        # Guida al dataset dimostrativo
    ├── carica_esempi.py        # Script Python per popolare il DB con alcolici e ricette IBA
    ├── dati_esempi.json        # Dataset JSON con 36 ingredienti e 30 cocktail predefiniti
    └── popola_db_esempi.sql    # Query SQL per inserimento diretto
```

---

## 🛠️ Requisiti di Sistema

- **Python**: 3.10 o versione successiva
- **MySQL**: 8.0 o versione successiva (oppure MariaDB compatibile)
- **Browser Web moderno**: Chrome, Safari, Firefox o Edge

---

## 🚀 Installazione & Avvio

### 1. Clonazione del Repository
```bash
git clone https://github.com/LuigiNicosia/gestionale-bar.git
cd "gestionale-bar"
```

### 2. Configurazione dell'Ambiente Virtuale Python
```bash
# Crea l'ambiente virtuale
python3 -m venv venv

# Attiva l'ambiente virtuale
# Su macOS / Linux:
source venv/bin/activate
# Su Windows:
# venv\Scripts\activate

# Installa le dipendenze
pip install -r requirements.txt
```

### 3. Configurazione del Database MySQL

Copia il file di configurazione modello:
```bash
cp config.example.py config.py
```
Modifica `config.py` (oppure crea `config_local.py`) impostando la password del tuo utente MySQL locale. In alternativa, puoi usare le variabili d'ambiente:
```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD="la_tua_password"
export DB_NAME=database_mysql
```

### 4. Creazione Tabelle Database
Dalla cartella principale del progetto, importa lo schema SQL:
```bash
mysql -u root -p < database_mysql.sql
```

*(Opzionale ma consigliato)* **Carica 30 cocktail IBA e 36 ingredienti reali**:
```bash
python3 esempi/carica_esempi.py
```

### 5. Avvio del Gestionale
```bash
python3 app.py
```
Oppure su **macOS**, fai semplicemente doppio clic su:
```bash
avvia_gestionale.command
```

Apri il browser all'indirizzo:  
👉 **`http://127.0.0.1:5001`**

> **PIN Predefinito Area Titolare**: `1234`  
> *(Puoi modificarlo cliccando sull'icona delle Impostazioni nell'Area Titolare).*

---

## 🔒 Sicurezza & Credenziali

Il repository adotta le migliori pratiche per la sicurezza del codice open-source:
- Nessuna password o chiave privata è tracciata su GitHub.
- Il file `.gitignore` esclude cartelle di sistema (`.DS_Store`), bytecode Python (`__pycache__/`), ambienti virtuali (`venv/`) e file contenenti credenziali locali private (`config_local.py`, `.env`).

---

## 📡 API Endpoints Principali

| Metodo | Endpoint | Descrizione |
| :--- | :--- | :--- |
| `GET` | `/api/drinks` | Elenco drink, categorie, prezzi e disponibilità in tempo reale |
| `POST` | `/api/drinks/custom` | Composizione e salvataggio rapido drink fuori menu |
| `GET` | `/api/orders` | Elenco comande con filtro per stato |
| `POST` | `/api/orders` | Creazione nuova comanda con scarico scorte |
| `PUT` | `/api/orders/<id>` | Modifica comanda (con rimborso e riscalamento magazzino) |
| `PATCH` | `/api/orders/<id>/status` | Avanzamento stato ordine (In Preparazione, Pronto, ecc.) |
| `GET` | `/api/inventory` | Giacenze magazzino, costi d'acquisto e soglie allarme |
| `POST` | `/api/inventory/restock` | Registrazione carico fornitore |
| `POST` | `/api/admin/verify-pin` | Verifica PIN per sblocco area riservata |
| `GET` | `/api/reports/summary` | Riepilogo incassi, drink venduti e marginalità |

---

## 👨‍💻 Autore

Sviluppato da **Luigi Nicosia**  
Progetto: **BarMaster PRO**  
GitHub: [@LuigiNicosia](https://github.com/LuigiNicosia)
