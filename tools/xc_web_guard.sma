/* X CLIENT Web: brauzerdan o'ynaydiganlar serverga ko'prik (ws_relay) orqali, bitta IP dan keladi.
 * Vanga Detector brauzer o'yinini noto'g'ri "chit" deb topadi (fayl hash 00000000) va amx_ban IP bo'yicha
 * hamma brauzer o'yinchilarini bloklab qo'yishi mumkin. Brauzerga chit DLL ulab bo'lmaydi.
 *
 * Ishlatish: vanga_detector.cfg dagi har bir shablon oldiga "xc_web_act " qo'shiladi:
 *   vanga_template_footer "xc_web_act kick [userid] 'Обнаружен [cheat]'"
 * O'yinchi IP si XC_WEB_IP bo'lsa - jazo bajarilmaydi (faqat log), aks holda buyruq odatdagidek bajariladi. */
#include <amxmodx>

#define XC_WEB_IP "51.89.39.107"

public plugin_init()
{
	register_plugin("X CLIENT Web Guard", "1.0", "X CLIENT")
	register_srvcmd("xc_web_act", "cmd_act")
}

public cmd_act()
{
	new args[256]
	read_args(args, charsmax(args))
	trim(args)

	new pos = contain(args, "#")
	if (pos >= 0)
	{
		new uid = str_to_num(args[pos + 1])
		new players[32], num
		get_players(players, num, "ch")
		for (new i = 0; i < num; i++)
		{
			new id = players[i]
			if (get_user_userid(id) != uid)
				continue
			new ip[32]
			get_user_ip(id, ip, charsmax(ip), 1)
			if (equal(ip, XC_WEB_IP))
			{
				log_amx("[X CLIENT Web] brauzer o'yinchisi uchun o'tkazib yuborildi: %s", args)
				return PLUGIN_HANDLED
			}
			break
		}
	}

	replace_all(args, charsmax(args), "'", "^"")
	server_cmd("%s", args)
	return PLUGIN_HANDLED
}
