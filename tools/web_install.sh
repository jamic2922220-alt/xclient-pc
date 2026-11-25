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
for r in json.load(sys.stdin):
    if r["tag_name"].startswith("web-build-"):
        a = [x for x in r["assets"] if x["name"] == "xc_web.zip"]
        if a: print(r["tag_name"], a[0]["browser_download_url"]); break')
[ -n "$URL" ] || { echo "XATO: GitHub da web-build topilmadi"; exit 1; }
echo "   $TAG"
wget -q -O /tmp/xc_web.zip "$URL" || { echo "XATO: yuklanmadi"; exit 1; }
rm -rf "$MMB/play.new" && mkdir -p "$MMB/play.new" && python3 -m zipfile -e /tmp/xc_web.zip "$MMB/play.new" || { echo "XATO: ochilmadi"; exit 1; }
rm -rf "$MMB/play.old"; [ -d "$MMB/play" ] && mv "$MMB/play" "$MMB/play.old"
mv "$MMB/play.new" "$MMB/play" && rm -rf "$MMB/play.old" /tmp/xc_web.zip
chown -R --reference="$MMB" "$MMB/play"
echo "   -> https://$HOST/play/"

echo "== 2) Ko'prik (WebSocket <-> o'yin serverlari)"
mkdir -p /opt/xc_relay && wget -qO /opt/xc_relay/ws_relay.py "$RAW/ws_relay.py" || { echo "XATO: ws_relay.py yuklanmadi"; exit 1; }
# saytning SSL sertifikati (nginx sozlamasidan)
CONF=$(grep -rls "server_name[^;]*$HOST" /etc/nginx/ 2>/dev/null | head -1)
CERT=$(grep -h "ssl_certificate " $CONF 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';')
KEY=$(grep -h "ssl_certificate_key" $CONF 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';')
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  for d in /etc/letsencrypt/live/$HOST /var/www/httpd-cert; do
    [ -f "$d/fullchain.pem" ] && CERT=$d/fullchain.pem && KEY=$d/privkey.pem
  done
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
