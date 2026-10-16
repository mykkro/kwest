# Jak napsat vlastní sadu otázek

Sady otázek jsou soubory JSON ve složce `tests/` (ve zdrojích `public/tests/`).

## 1. Vytvoř soubor sady

Například `tests/M1.json`:

```json
{
  "id": "M1",
  "name": "Matematika – 5. třída",
  "questions": [
    { "q": "Kolik je 7 × 8?", "answers": ["56", "54", "48", "64"], "correct": 0 }
  ]
}
```

- `id` – krátký jedinečný kód sady (písmena a čísla).
- `name` – název, který uvidí žák v nabídce.
- `questions` – **alespoň 30 otázek**. Je-li jich víc, hra jich pokaždé náhodně vybere 30.
- `q` – text otázky.
- `answers` – **přesně 4 různé odpovědi**.
- `correct` – pořadí správné odpovědi: **0 = první, 1 = druhá, 2 = třetí, 3 = čtvrtá**.

Pořadí odpovědí se ve hře zamíchá, takže na pozici správné odpovědi v souboru nezáleží.

## 2. Přidej sadu do seznamu

Do `tests/index.json` přidej řádek:

```json
{ "id": "M1", "name": "Matematika – 5. třída", "file": "M1.json" }
```

## 3. Odkaz přímo na sadu

`https://adresa-hry/?test=M1` otevře hru s předvybranou sadou M1.

## Zásady dobrých otázek

- Jedna odpověď je jednoznačně správná, ostatní jsou věrohodné, ale jasně špatné.
- Žádné chytáky a dvojí zápory.
- Krátké věty, slova přiměřená věku žáků.
- Soubor ukládej v kódování UTF-8.

Když je v sadě chyba, hra ji v nabídce označí jako nedostupnou a napíše, ve které otázce chyba je.
