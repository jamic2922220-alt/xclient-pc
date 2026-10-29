#!/bin/bash
# Apache 2.4 da .htaccess sinovi: yuqori papkada https ga yo'naltirish bor, mmb papkasida bizning .htaccess
O=diag/out; mkdir -p $O; : > $O/summary.txt
sudo apt-get install -y -qq apache2 >/dev/null 2>&1
sudo a2enmod headers expires rewrite deflate >/dev/null
sudo mkdir -p /var/www/html/mmb /var/www/html/other
echo '<div id="app">ok</div>' | sudo tee /var/www/html/mmb/xc.html >/dev/null
echo '<div id="app">x</div>' | sudo tee /var/www/html/other/xc.html >/dev/null
printf 'RewriteEngine On\nRewriteCond %%{HTTPS} off\nRewriteRule ^(.*)$ https://%%{HTTP_HOST}/$1 [R=301,L]\n' | sudo tee /var/www/html/.htaccess >/dev/null
sudo cp diag/htaccess /var/www/html/mmb/.htaccess
sudo sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
sudo apache2ctl configtest >> $O/summary.txt 2>&1
sudo systemctl restart apache2 || sudo service apache2 restart
sleep 2
for u in /mmb/xc.html /mmb/nope.html /other/xc.html; do echo "=== $u" >> $O/summary.txt; curl -s -D - -o /dev/null "http://127.0.0.1$u" | grep -iE "^HTTP|^location|^cache-control|^expires" >> $O/summary.txt; done
sudo tail -5 /var/log/apache2/error.log >> $O/summary.txt 2>&1
