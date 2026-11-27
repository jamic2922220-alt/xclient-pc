#!/bin/bash
# X CLIENT iPhone: GitHub dagi oxirgi imzosiz IPA ni olib, admin panel > iPhone ga yuklangan
# kalit + Apple sertifikati + profil bilan imzolaydi va mmb/mobile/X-CLIENT.ipa ga qo'yadi.
# Serverda (root) ishga tushiriladi:
#   wget -qO /root/ios_sign.sh https://raw.githubusercontent.com/jamic2922220-alt/xclient-pc/claude/single-client/tools/ios_sign.sh && bash /root/ios_sign.sh
# Maxfiy kalit serverdan chiqmaydi: faqat imzolash vaqtida /root/xc_ios ga yoziladi va darhol o'chiriladi.
MMB=${MMB:-/var/www/boost_top_co_usr/data/www/boost-top.com/mmb}
W=/root/xc_ios
REPO=jamic2922220-alt/cssborka.uz-mobile
mkdir -p "$W" && chmod 700 "$W" && cd "$W" || exit 1

if [ ! -x "$W/zsign" ]; then
  echo "== zsign (imzolovchi) yig'ilmoqda - faqat birinchi marta, 1-2 daqiqa..."
  apt-get install -y -q git g++ make pkg-config libssl-dev zlib1g-dev >/dev/null 2>&1 || { echo "XATO: apt-get install ishlamadi"; exit 1; }
  rm -rf src && git clone -q --depth 1 https://github.com/zhlynn/zsign src || { echo "XATO: zsign yuklanmadi"; exit 1; }
  (cd src/build/linux && make clean >/dev/null 2>&1; make -j2 >/dev/null 2>&1) || { echo "XATO: zsign yig'ilmadi"; exit 1; }
  Z=$(find src -type f -name zsign -perm -u+x | head -1)
  [ -n "$Z" ] && cp "$Z" "$W/zsign" || { echo "XATO: zsign topilmadi"; exit 1; }
fi

echo "== Sertifikat va profil (admin panel > iPhone)"
python3 - "$MMB/xc_data" "$W" <<'PY' || exit 1
import json, sys, base64, os, time
d, w = sys.argv[1], sys.argv[2]
def rd(n):
    f = os.path.join(d, 'ios', n + '.php')
    if not os.path.isfile(f):
        sys.exit('XATO: admin panel > iPhone da "%s" yo\'q' % {'key': '1. Kalit', 'cert': '2. Sertifikat', 'prov': '3. Profil'}[n])
    s = open(f, encoding='utf-8').read()
    return json.loads(s[s.index('\n') + 1:])
k, c, p = rd('key'), rd('cert'), rd('prov')
os.umask(0o077)
open(os.path.join(w, 'key.pem'), 'w').write(k['pem'])
open(os.path.join(w, 'cert.pem'), 'w').write(c['pem'])
open(os.path.join(w, 'x.mobileprovision'), 'wb').write(base64.b64decode(p['b64']))
print('   profil: %s, %s ta iPhone, %s gacha' % (p.get('name'), p.get('n'), time.strftime('%d.%m.%Y', time.localtime(p.get('exp', 0)))))
if p.get('exp', 0) and p['exp'] < time.time():
    sys.exit('XATO: profil muddati tugagan - Apple da yangilab, admin panelga qayta yuklang')
PY

echo "== Oxirgi iPhone yig'ishi (GitHub)"
read -r TAG URL < <(curl -s "https://api.github.com/repos/$REPO/releases?per_page=30" | python3 -c '
import json, sys
best = None
for r in json.load(sys.stdin):
    if r["tag_name"].startswith("ios-build-"):
        a = [x for x in r["assets"] if x["name"].endswith(".ipa")]
        n = int(r["tag_name"].rsplit("-", 1)[1])
        if a and (best is None or n > best[0]): best = (n, r["tag_name"], a[0]["browser_download_url"])
if best: print(best[1], best[2])')
[ -n "$URL" ] || { echo "XATO: GitHub da iPhone yig'ishi topilmadi"; rm -f key.pem; exit 1; }
VER="1.0.${TAG#ios-build-}"
echo "   $TAG (versiya $VER)"
wget -q -O u.ipa "$URL" || { echo "XATO: IPA yuklanmadi"; rm -f key.pem; exit 1; }

echo "== Imzolash"
./zsign -k key.pem -c cert.pem -m x.mobileprovision -o s.ipa -z 6 u.ipa > zsign.log 2>&1
RC=$?
rm -f key.pem
[ $RC -eq 0 ] && [ -s s.ipa ] || { echo "XATO: imzolab bo'lmadi:"; tail -5 zsign.log; exit 1; }

mkdir -p "$MMB/mobile"
cp s.ipa "$MMB/mobile/X-CLIENT.ipa.tmp" && mv "$MMB/mobile/X-CLIENT.ipa.tmp" "$MMB/mobile/X-CLIENT.ipa"
echo "$VER" > "$MMB/mobile/ios_ver.txt"
chown --reference="$MMB" "$MMB/mobile/X-CLIENT.ipa" "$MMB/mobile/ios_ver.txt"
rm -f u.ipa s.ipa
echo "TAYYOR: X CLIENT iPhone $VER -> https://mmb.boost-top.com/ios.php"
