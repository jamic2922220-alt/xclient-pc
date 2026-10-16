/*
X CLIENT - FPS rejimi menyusi (Sozlamalar > FPS rejimi)
Bir bosishda: Kuchsiz PC / Maksimal FPS / Muvozanat / Chiroyli
Har biri cstrike/xc_fps_*.cfg faylini ishga tushiradi.
*/

#include "Framework.h"
#include "PicButton.h"
#include "YesNoMessageBox.h"

#define ART_BANNER "gfx/shell/head_fps"

class CMenuXcFps : public CMenuFramework
{
public:
	CMenuXcFps() : CMenuFramework( "CMenuXcFps" ) { }

private:
	void _Init( void ) override;
	void Apply( const char *mode, const char *msg );

	void Low()      { Apply( "low",      "Kuchsiz PC rejimi yoqildi" ); }
	void Max()      { Apply( "max",      "Maksimal FPS rejimi yoqildi" ); }
	void Balanced() { Apply( "balanced", "Muvozanat rejimi yoqildi" ); }
	void Pretty()   { Apply( "pretty",   "Chiroyli rejim yoqildi" ); }
};

void CMenuXcFps::Apply( const char *mode, const char *msg )
{
	char cmd[128];
	snprintf( cmd, sizeof( cmd ), "exec xc_fps_%s.cfg\nseta xc_fps_mode \"%s\"\nhost_writeconfig\n", mode, mode );
	EngFuncs::ClientCmd( false, cmd );
	UI_ShowMessageBox( L( msg ));
}

void CMenuXcFps::_Init( void )
{
	banner.SetPicture( ART_BANNER );
	AddItem( banner );

	AddButton( L( "Kuchsiz PC" ), L( "Eski noutbuk va Intel HD uchun: eng yengil grafika" ),
		PC_CONFIG, VoidCb( &CMenuXcFps::Low ), QMF_NOTIFY );
	AddButton( L( "Maksimal FPS" ), L( "Raqobat uchun: yuqori FPS, kechikishsiz" ),
		PC_CONFIG, VoidCb( &CMenuXcFps::Max ), QMF_NOTIFY );
	AddButton( L( "Muvozanat" ), L( "Yaxshi ko'rinish va barqaror FPS" ),
		PC_CONFIG, VoidCb( &CMenuXcFps::Balanced ), QMF_NOTIFY );
	AddButton( L( "Chiroyli" ), L( "Kuchli kompyuterlar uchun eng yaxshi sifat" ),
		PC_CONFIG, VoidCb( &CMenuXcFps::Pretty ), QMF_NOTIFY );
	AddButton( L( "Done" ), L( "Go back to the previous menu." ),
		PC_DONE, VoidCb( &CMenuXcFps::Hide ), QMF_NOTIFY );
}

ADD_MENU( menu_xcfps, CMenuXcFps, UI_XcFps_Menu );
