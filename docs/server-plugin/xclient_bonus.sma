/* X CLIENT bonus - CS 1.6 server plagini (AMX Mod X 1.8.2+)
 *
 * X CLIENT launcheri bilan o'ynayotgan o'yinchini taniydi (menyu "setinfo _xc 1" qo'yadi) va:
 *   - kirganda chatda e'lon: "Nik X CLIENT bilan kirdi"
 *   - nik oldiga [X] teg (ixtiyoriy, xc_tag 1)
 *   - har raundda qo'shimcha pul (ixtiyoriy, xc_money)
 *   - VIP huquqlari (ixtiyoriy, xc_flags, masalan "t")
 *   - har N daqiqada reklama: serverda nechta X CLIENT o'yinchisi borligi va yuklab olish manzili
 *   - /xclient buyrug'i - yuklab olish manzili
 *
 * Sozlamalar (amxx.cfg yoki server.cfg):
 *   xc_tag "1"        - nikka [X] teg qo'shish (1/0)
 *   xc_money "0"      - har raund boshida qo'shimcha pul (0 = o'chiq)
 *   xc_flags ""       - X CLIENT o'yinchilariga beriladigan AMXX huquqlari (masalan "t" - VIP), bo'sh = yo'q
 *   xc_join_msg "1"   - kirganda chatda e'lon (1/0)
 *   xc_ad_min "10"    - reklama oralig'i, daqiqa (0 = o'chiq)
 *   xc_url "cssborka.uz/xclient"
 *
 * Eslatma: "_xc" ni har kim konsolda qo'lda yozishi mumkin - shuning uchun bu bonuslar kosmetik/kichik bo'lsin
 * (teg, e'lon, ozgina pul, VIP chat). O'yin muvozanatini buzadigan katta ustunlik bermang.
 */
#include <amxmodx>
#include <cstrike>

#define PLUGIN  "X CLIENT bonus"
#define VERSION "1.0"
#define AUTHOR  "X CLIENT"

new bool:g_xc[33];
new g_tag, g_money, g_flags, g_joinmsg, g_admin, g_url;

public plugin_init()
{
	register_plugin(PLUGIN, VERSION, AUTHOR);
	register_cvar("xclient_bonus", VERSION, FCVAR_SERVER | FCVAR_SPONLY);   // monitoringlarda ko'rinadi
	g_tag     = register_cvar("xc_tag", "1");
	g_money   = register_cvar("xc_money", "0");
	g_flags   = register_cvar("xc_flags", "");
	g_joinmsg = register_cvar("xc_join_msg", "1");
	g_admin   = register_cvar("xc_ad_min", "10");
	g_url     = register_cvar("xc_url", "cssborka.uz/xclient");
	register_clcmd("say /xclient", "cmd_info");
	register_clcmd("say_team /xclient", "cmd_info");
	register_event("ResetHUD", "ev_spawn", "be");
	set_task(60.0, "task_ad", 4100, _, _, "b");
}

public client_putinserver(id)
{
	g_xc[id] = is_xc(id);
	if (!g_xc[id]) return;
	apply_flags(id);
	set_task(1.0, "task_tag", id);
	if (get_pcvar_num(g_joinmsg)) set_task(3.0, "task_join", id + 200);
}

public client_disconnect(id) { g_xc[id] = false; remove_task(id); remove_task(id + 200); }

public client_infochanged(id)
{
	if (!is_user_connected(id)) return;
	new bool:now = is_xc(id);
	if (now && !g_xc[id]) { g_xc[id] = true; apply_flags(id); }
	else if (!now) g_xc[id] = false;
	if (g_xc[id]) set_task(0.5, "task_tag", id);
}

bool:is_xc(id)
{
	new v[4];
	get_user_info(id, "_xc", v, charsmax(v));
	return v[0] == '1';
}

apply_flags(id)
{
	new fl[24];
	get_pcvar_string(g_flags, fl, charsmax(fl));
	if (fl[0]) set_user_flags(id, read_flags(fl));
}

public task_tag(id)
{
	if (!is_user_connected(id) || !g_xc[id] || !get_pcvar_num(g_tag)) return;
	new name[32];
	get_user_name(id, name, charsmax(name));
	if (containi(name, "[X]") == 0) return;
	new nn[32];
	formatex(nn, charsmax(nn), "[X] %s", name);
	set_user_info(id, "name", nn);
}

public task_join(t)
{
	new id = t - 200;
	if (!is_user_connected(id)) return;
	new name[32], url[64];
	get_user_name(id, name, charsmax(name));
	get_pcvar_string(g_url, url, charsmax(url));
	client_print(0, print_chat, "[X CLIENT] %s X CLIENT bilan kirdi. Siz ham yuklab oling: %s", name, url);
}

public ev_spawn(id)
{
	new m = get_pcvar_num(g_money);
	if (m <= 0 || !g_xc[id] || !is_user_alive(id)) return;
	cs_set_user_money(id, min(cs_get_user_money(id) + m, 16000), 1);
}

public task_ad()
{
	static mins;
	new every = get_pcvar_num(g_admin);
	if (every <= 0) return;
	if (++mins < every) return;
	mins = 0;
	new n = 0, url[64];
	for (new i = 1; i <= 32; i++) if (is_user_connected(i) && g_xc[i]) n++;
	get_pcvar_string(g_url, url, charsmax(url));
	if (n > 0) client_print(0, print_chat, "[X CLIENT] Serverda %d ta X CLIENT o'yinchisi. Aniq tegish, o'zi tuzatiladi - yuklab oling: %s", n, url);
	else client_print(0, print_chat, "[X CLIENT] Bepul CS 1.6 launcher: aniq tegish, do'stlar, duel - %s", url);
}

public cmd_info(id)
{
	new url[64];
	get_pcvar_string(g_url, url, charsmax(url));
	client_print(id, print_chat, "[X CLIENT] Yuklab olish: %s  |  Siz %s", url, g_xc[id] ? "X CLIENT bilan o'ynayapsiz" : "hali X CLIENT da emassiz");
	return PLUGIN_CONTINUE;
}
