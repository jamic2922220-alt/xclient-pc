#!/bin/bash
# X CLIENT Web: serverda (51.89.39.107, root) bir buyruq bilan:
#  1) GitHub dagi oxirgi brauzer versiyasini (web-build-N) mmb/play/ ga qo'yadi
#  2) WebSocket <-> UDP ko'prigini (ws_relay.py) doimiy xizmat qilib o'rnatadi (27080-port, saytning SSL sertifikati bilan)
# Ishga tushirish:
#   wget -qO /root/web_install.sh https://raw.githubusercontent.com/jamic2922220-alt/xclient-pc/claude/single-client/tools/web_install.sh && bash /root/web_install.sh
MMB=${MMB:-/var/www/boost_top_co_usr/data/www/boost-top.com/mmb}
HOST=mmb.boost-top.com
PORT=27080
RAW=https://raw.githubusercontent.com/jamic2922220-alt/xclient-pc/claude/single-client/tools
REPO=jamic2922220-alt/cssborka.uz-mobile

echo "== 1) Brauzer versiyasi (GitHub)"
read -r TAG URL < <(curl -s "https://api.github.com/repos/$REPO/releases?per_page=30" | python3 -c '
import json, sys
best = None
for r in json.load(sys.stdin):
    if r["tag_name"].startswith("web-build-"):
        a = [x for x in r["assets"] if x["name"] == "xc_web.zip"]
        n = int(r["tag_name"].rsplit("-", 1)[1])
        if a and (best is None or n > best[0]): best = (n, r["tag_name"], a[0]["browser_download_url"])
if best: print(best[1], best[2])')
[ -n "$URL" ] || { echo "XATO: GitHub da web-build topilmadi"; exit 1; }
echo "   $TAG"
wget -q -O /tmp/xc_web.zip "$URL" || { echo "XATO: yuklanmadi"; exit 1; }
rm -rf "$MMB/play.new" && mkdir -p "$MMB/play.new" && python3 -m zipfile -e /tmp/xc_web.zip "$MMB/play.new" || { echo "XATO: ochilmadi"; exit 1; }
rm -rf "$MMB/play.old"; [ -d "$MMB/play" ] && mv "$MMB/play" "$MMB/play.old"
mv "$MMB/play.new" "$MMB/play" && rm -rf "$MMB/play.old" /tmp/xc_web.zip
# sahifa (index.html, main.js) brauzerda eslab qolinmasin - yangilanish darhol yetib borsin; katta fayllar keshlanadi
cat > "$MMB/play/.htaccess" <<'HT'
<IfModule mod_headers.c>
  <FilesMatch "^(index\.html|main\.js|manifest\.json)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
</IfModule>
<IfModule mod_expires.c>
  <FilesMatch "^(index\.html|main\.js|manifest\.json)$">
    ExpiresActive Off
  </FilesMatch>
</IfModule>
HT
chown -R --reference="$MMB" "$MMB/play"
echo "   -> https://$HOST/play/"

echo "== 2) Ko'prik (WebSocket <-> o'yin serverlari)"
mkdir -p /opt/xc_relay && wget -qO /opt/xc_relay/ws_relay.py "$RAW/ws_relay.py" || { echo "XATO: ws_relay.py yuklanmadi"; exit 1; }
# saytning SSL sertifikati (nginx / FastPanel sozlamasidan; qo'shtirnoq, include va boshqa fayllar ham)
CERT=""; KEY=""
for CONF in $(grep -rls "$HOST" /etc/nginx/ 2>/dev/null); do
  C=$(grep -hE "^\s*ssl_certificate\s" "$CONF" | head -1 | sed -E 's/^\s*ssl_certificate\s+//; s/[";]//g; s/\s+$//')
  K=$(grep -hE "^\s*ssl_certificate_key\s" "$CONF" | head -1 | sed -E 's/^\s*ssl_certificate_key\s+//; s/[";]//g; s/\s+$//')
  if [ -f "$C" ] && [ -f "$K" ]; then CERT=$C; KEY=$K; echo "   nginx: $CONF"; break; fi
done
if [ -z "$CERT" ]; then
  for C in /var/www/httpd-cert/*/$HOST*.crt /var/www/httpd-cert/$HOST*.crt /etc/letsencrypt/live/$HOST/fullchain.pem; do
    [ -f "$C" ] || continue
    K=${C%.crt}.key; [ "${C##*.}" = "pem" ] && K=$(dirname "$C")/privkey.pem
    [ -f "$K" ] && CERT=$C && KEY=$K && break
  done
fi
if [ -z "$CERT" ]; then
  echo "   topilmadi. nginx dagi ssl qatorlari:"; grep -rhn "ssl_certificate" /etc/nginx/ 2>/dev/null | grep -i "boost" | head -6
  ls -la /var/www/httpd-cert/ 2>/dev/null | head
fi
[ -f "$CERT" ] && [ -f "$KEY" ] || { echo "XATO: $HOST uchun SSL sertifikat topilmadi (nginx: $CONF)"; exit 1; }
echo "   sertifikat: $CERT"
cat > /etc/systemd/system/xc-relay.service <<EOF
[Unit]
Description=X CLIENT Web relay (WebSocket <-> CS 1.6 UDP)
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/xc_relay/ws_relay.py --port $PORT --cert $CERT --key $KEY
Restart=always
RestartSec=3
DynamicUser=no
User=root
LimitNOFILE=8192

[Install]
WantedBy=multi-user.target
EOF
# sertifikat yangilanganda (Let's Encrypt) yangisini o'qisin - har kuni tunda qayta ishga tushadi
echo "17 4 * * * root systemctl restart xc-relay" > /etc/cron.d/xc-relay
systemctl daemon-reload && systemctl enable -q xc-relay && systemctl restart xc-relay
sleep 1
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow $PORT/tcp >/dev/null && echo "   ufw: $PORT ochildi"; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then firewall-cmd -q --permanent --add-port=$PORT/tcp && firewall-cmd -q --reload && echo "   firewalld: $PORT ochildi"; fi
systemctl is-active --quiet xc-relay && echo "   ko'prik ishlayapti: wss://$HOST:$PORT/" || { echo "XATO: ko'prik ishga tushmadi:"; journalctl -u xc-relay -n 5 --no-pager; exit 1; }
echo "TAYYOR: https://$HOST/play/"
