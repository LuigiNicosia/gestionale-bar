# BarMaster PRO

Gestionale per ordini, ricette e magazzino di un bar. Usa Flask per l'interfaccia e MySQL per salvare i dati.

## Cosa puoi fare

- Inserire comande e seguirne lo stato dalla coda ordini.
- **Modificare le comande già inviate** (es. cliente cambia drink prima della preparazione): il magazzino rimborsa e riscala le dosi in automatico.
- **Creare Drink Personalizzati / Fuori Menu** al volo con calcolo istantaneo del food cost e aggiunta immediata alla comanda.
- **Calcolo Costo Materie Prime & Guadagno per Drink**: imposta il prezzo d'acquisto delle bottiglie e scopri il margine netto (€ e %) per ogni cocktail.
- Calcolare quanti drink sono disponibili in tempo reale in base a ricette e giacenze di magazzino.
- Gestire alcolici, ricette, carichi merce fornitore e registro movimenti.
- Consultare report di cassa, incassi e margine operativo lordo.

## Requisiti

- Python 3.10 o successivo
- MySQL in esecuzione

## Configurazione

Imposta le credenziali MySQL con queste variabili d'ambiente. Se `DB_PASSWORD` è vuota, il gestionale prova a collegarsi senza password.

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=""
export DB_NAME=database_mysql
```

Per impostare la chiave delle sessioni Flask, configura anche `SECRET_KEY`. Se non la imposti, l'app ne genera una all'avvio; le sessioni attive non sopravvivono al riavvio.

## Database e avvio

Dalla cartella `GESTIONALE BAR`, crea lo schema e le tabelle:

```bash
mysql -u root -p < database_mysql.sql
```

Questo script ricrea le tabelle e cancella i dati che contengono. Usalo solo su un database nuovo o dopo aver fatto un backup.

Installa le dipendenze e avvia il server:

```bash
pip install -r requirements.txt
python3 app.py
```

Apri <http://127.0.0.1:5001>. Su Mac puoi avviare il programma anche con `avvia_gestionale.command`.

Il PIN iniziale del titolare è `1234`; cambialo dalla schermata di gestione dopo il primo accesso.

## Dati di esempio

La cartella `esempi/` contiene ricette e giacenze di esempio. Per caricarle:

```bash
python3 esempi/carica_esempi.py
```

Lo script chiede la password MySQL nel terminale se quella configurata non consente la connessione. Non salva la password nei file del progetto.
