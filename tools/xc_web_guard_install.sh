#!/bin/bash
# X CLIENT Web Guard ni o'yin serverlariga o'rnatish (Pterodactyl mashinasida, root):
#   wget -qO /root/xc_web_guard_install.sh https://raw.githubusercontent.com/jamic2922220-alt/xclient-pc/claude/single-client/tools/xc_web_guard_install.sh && bash /root/xc_web_guard_install.sh
# Har bir serverda: plaginni kompilyatsiya qiladi, plugins.ini ga qo'shadi, vanga_detector.cfg shablonlariga "xc_web_act " qo'shadi.
# Zaxira: *.xc_zaxira fayllari. Keyin serverlarni panelda qayta ishga tushiring.
RAW=https://raw.githubusercontent.com/jamic2922220-alt/xclient-pc/claude/single-client/tools
TMP=$(mktemp -d)
wget -qO "$TMP/xc_web_guard.sma" "$RAW/xc_web_guard.sma" || { echo "XATO: sma yuklanmadi"; exit 1; }
found=0
for CFG in /var/lib/pterodactyl/volumes/*/cstrike/addons/amxmodx/configs/vanga_detector.cfg; do
  [ -f "$CFG" ] || continue
  found=1
  AMX=$(dirname "$(dirname "$CFG")")
  echo "== $AMX"
  SC="$AMX/scripting"
  if [ ! -x "$SC/amxxpc" ]; then echo "   XATO: $SC/amxxpc yo'q"; continue; fi
  cp "$TMP/xc_web_guard.sma" "$SC/xc_web_guard.sma"
  ( cd "$SC" && ./amxxpc xc_web_guard.sma -o"$AMX/plugins/xc_web_guard.amxx" ) > "$TMP/c.log" 2>&1
  if [ ! -s "$AMX/plugins/xc_web_guard.amxx" ]; then echo "   XATO: kompilyatsiya:"; tail -5 "$TMP/c.log"; continue; fi
  echo "   plagin kompilyatsiya qilindi"
  PI="$AMX/configs/plugins.ini"
  cp -n "$PI" "$PI.xc_zaxira"
  grep -q "^xc_web_guard.amxx" "$PI" || echo "xc_web_guard.amxx          ; X CLIENT brauzer o'yinchilari (ko'prik IP) uchun Vanga jazosi yo'q" >> "$PI"
  cp -n "$CFG" "$CFG.xc_zaxira"
  sed -i -E 's/^(vanga_template_[a-z_]+[[:space:]]+")(xc_web_act )?/\1xc_web_act /' "$CFG"
  grep "^vanga_template" "$CFG" | sed 's/^/   /'
  chown --reference="$PI" "$AMX/plugins/xc_web_guard.amxx" "$SC/xc_web_guard.sma"
done
rm -rf "$TMP"
[ $found = 1 ] && echo "TAYYOR: endi Pterodactyl panelida serverlarni qayta ishga tushiring (Restart)" || echo "XATO: vanga_detector.cfg topilmadi"
