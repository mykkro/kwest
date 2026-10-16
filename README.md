# Kwest

Vzdělávací hra v prohlížeči: projdi hradní bludiště, zodpověz otázky, otevři dveře a najdi východ.

## Vývoj

```bash
npm install
npm run dev        # vývojový server
npm test           # unit testy (Vitest)
npm run e2e        # test v prohlížeči (Playwright; poprvé: npx playwright install chromium)
npm run build      # statický web do dist/
```

## Nasazení

Obsah složky `dist/` nahraj na libovolný statický web (i do podsložky). Hra nic neodesílá na server.

## Sady otázek

Viz [docs/otazky.md](docs/otazky.md). Přímý odkaz na sadu: `?test=Z1`.

## Licence a původ

Všechny textury, modely a otázky jsou nové, vytvořené pro tento projekt. Složka `legacy/` (původní hra z roku 2006)
slouží jen jako reference, není součástí repozitáře ani buildu.
