# Dati di esempio

In questa cartella trovi ingredienti, drink e ricette da usare per provare il gestionale.

## File

- `carica_esempi.py`: carica i dati nel database configurato in `config.py`.
- `popola_db_esempi.sql`: script da eseguire con MySQL Workbench o il client MySQL.
- `dati_esempi.json`: stessi dati in formato JSON, per consultazione.

## Caricamento con Python

Dalla cartella `GESTIONALE BAR`:

```bash
python3 esempi/carica_esempi.py
```

Se la connessione MySQL richiede una password diversa da quella configurata, lo script la chiede nel terminale per questa sessione.

## Caricamento da MySQL

Apri `popola_db_esempi.sql` con MySQL Workbench ed eseguilo, oppure usa il client:

```bash
mysql -u root -p database_mysql < esempi/popola_db_esempi.sql
```

Lo script inserisce dati nel database: se lo esegui più volte, controlla prima il contenuto di `popola_db_esempi.sql` per evitare duplicati.
