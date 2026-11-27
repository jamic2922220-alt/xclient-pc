# Menyu testlari

Har yangi menyu versiyasini chiqarishdan oldin:

```
./tests/menu/run.sh            # hammasi o'tsa: === HAMMASI O'TDI ===
./tests/menu/run.sh --update   # ko'rinish ataylab o'zgargan bo'lsa - yangi rasmlarni asos qilib saqlash
```

Kerak: `php`, `node` + `playwright`, `python3` + `Pillow`.

Nima tekshiriladi:
- **crawl.js** - 11 ta oyna, Sozlamalarning hamma bo'limi va chat ochiladi: JS xatolari, panel tashqarisiga chiqqan
  yoki ustma-ust tushgan bloklar, chat oynasining o'lchami.
- **ingame.js** - serverga ulangan, ESC menyusi ochiq holat (`gameUi.shown` bo'lmasa ham): serverlar yangilanadi,
  effektlar o'chadi, menyu yopilganda so'rovlar to'xtaydi.
- **visual.py** - har oyna skrinshoti `baseline/` dagi oldingisi bilan solishtiriladi (2% dan ko'p farq - FAIL, `diff_*.png`).

Chiqarish: `python3 tools/build_menu.py web/menyu.zip` -> zipni mmb ga ochish -> admin panel > Menyu versiyalari > Beta -> Hammaga.
