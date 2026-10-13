# Cesty KHK

Aplikace nad otevřenými daty Královéhradeckého kraje: prioritizace oprav silnic II. a III. třídy podle stavu povrchu a okolí (školy, nemocnice, IZS, zastávky, linky IREDO) a veřejný přehled, co se opravuje.

Data pocházejí z [datakhk.cz](https://www.datakhk.cz/search?collection=dataset).

## Spuštění

```bash
npm install
npm run fetch-data
npm run dev
```

Otevře se [http://localhost:5173](http://localhost:5173).

- **Správa silnic** — žebříček priority, váhy, dopady uzavírky, návrh opravy a text oznámení.
- **Veřejnost** — probíhající a plánované práce, „jede můj autobus?“, hlášení výtluku.

Plánované opravy v datech kraje nejsou. Demo proto navrhne první úseky podle skóre; ve správě je lze změnit. Změny zůstanou v prohlížeči.

## Zdroje

Stav povrchu 2024, opravy od 2016, zimní údržba, autobusové linky a zastávky VDKHK, zaručené přípoje, školy, nemocnice, ZZS, HZS, policie, praktici, sociální služby, průmyslové zóny.
