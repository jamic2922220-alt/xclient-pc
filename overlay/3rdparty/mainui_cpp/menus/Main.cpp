/*
Copyright (C) 1997-2001 Id Software, Inc.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.

*/


#include "Framework.h"
#include "Action.h"
#include "Bitmap.h"
#include "PicButton.h"
#include "YesNoMessageBox.h"
#include "keydefs.h"
#include "MenuStrings.h"
#include "PlayerIntroduceDialog.h"
#include "gameinfo.h"
#include "AnimatedBanner.h"
#include "MovieBanner.h"

// ---- X CLIENT: tilga qarab matn (uzbek / russian / english) ----
static const char *XL( const char *en, const char *ru, const char *uz )
{
	// standart til - o'zbekcha; keyinchalik Sozlamalar > Tizim dan tanlanadi
	const char *l = EngFuncs::GetCvarString( "ui_language" );
	if( l && ( !stricmp( l, "russian" ) || !stricmp( l, "ukrainian" ) || !stricmp( l, "kazakh" ) || !stricmp( l, "kyrgyz" ) || !stricmp( l, "tajik" ))) return ru;
	if( l && ( !stricmp( l, "en" ) || !stricmp( l, "turkish" ) || !stricmp( l, "azerbaijani" ))) return en;
	return uz;
}

#define ART_MINIMIZE_N	"gfx/shell/min_n"
#define ART_MINIMIZE_F	"gfx/shell/min_f"
#define ART_MINIMIZE_D	"gfx/shell/min_d"
#define ART_CLOSEBTN_N	"gfx/shell/cls_n"
#define ART_CLOSEBTN_F	"gfx/shell/cls_f"
#define ART_CLOSEBTN_D	"gfx/shell/cls_d"

class CMenuMain: public CMenuFramework
{
public:
	CMenuMain() : CMenuFramework( "CMenuMain" ) { }

	bool KeyDown( int key ) override;

	void QuitDialogCb();

private:
	void _Init() override;
	void _VidInit( ) override;
	void Think() override;

	void VidInit(bool connected);

	void DisconnectCb();
	void DisconnectDialogCb();
	void HazardCourseDialogCb();
	void HazardCourseCb();

	CMenuAnimatedBanner animatedBanner;
	CMenuMovieBanner movieBanner;

	CMenuPicButton	console;
	CMenuPicButton	resumeGame;
	CMenuPicButton	disconnect;
	CMenuPicButton	newGame;
	CMenuPicButton	hazardCourse;
	CMenuPicButton	configuration;
	CMenuPicButton	saveRestore;
	CMenuPicButton	multiPlayer;
	CMenuPicButton	customGame;
	CMenuPicButton	readme;
	CMenuPicButton	previews;
	CMenuPicButton	quit;

	// buttons on top right. Maybe should be drawn if fullscreen == 1?
	CMenuBitmap	minimizeBtn;
	CMenuBitmap	quitButton;

	// quit dialog
	CMenuYesNoMessageBox dialog;

	bool bTrainMap;
	bool bCustomGame;
};

void CMenuMain::QuitDialogCb()
{
	if( CL_IsActive() && EngFuncs::GetCvarFloat( "host_serverstate" ) && EngFuncs::GetCvarFloat( "maxplayers" ) == 1.0f )
		dialog.SetMessage( L( "StringsList_235" ) );
	else
		dialog.SetMessage( L( "GameUI_QuitConfirmationText" ) );

	dialog.onPositive.SetCommand( false, "quit \"menu dialog\"\n" );
	dialog.Show();
}

void CMenuMain::DisconnectCb()
{
	EngFuncs::ClientCmd( false, "disconnect\n" );
	VidInit( false );
	CalcPosition();
	CalcSizes();
	VidInitItems();
}

void CMenuMain::DisconnectDialogCb()
{
	dialog.onPositive = VoidCb( &CMenuMain::DisconnectCb );
	dialog.SetMessage( L( "Really disconnect?" ) );
	dialog.Show();
}

void CMenuMain::HazardCourseDialogCb()
{
	dialog.onPositive = VoidCb( &CMenuMain::HazardCourseCb );;
	dialog.SetMessage( L( "StringsList_234" ) );
	dialog.Show();
}

/*
=================
CMenuMain::Key
=================
*/
bool CMenuMain::KeyDown( int key )
{
	if( UI::Key::IsEscape( key ) )
	{
		if ( CL_IsActive( ))
		{
			if( !dialog.IsVisible() )
				UI_CloseMenu();
		}
		else
		{
			QuitDialogCb( );
		}
		return true;
	}
	return CMenuFramework::KeyDown( key );
}

/*
=================
UI_Main_HazardCourse
=================
*/
void CMenuMain::HazardCourseCb()
{
	if( EngFuncs::GetCvarFloat( "host_serverstate" ) && EngFuncs::GetCvarFloat( "maxplayers" ) > 1 )
		EngFuncs::HostEndGame( "end of the game" );

	EngFuncs::CvarSetValue( "skill", 1.0f );
	EngFuncs::CvarSetValue( "deathmatch", 0.0f );
	EngFuncs::CvarSetValue( "teamplay", 0.0f );
	EngFuncs::CvarSetValue( "pausable", 1.0f ); // singleplayer is always allowing pause
	EngFuncs::CvarSetValue( "coop", 0.0f );
	EngFuncs::CvarSetValue( "maxplayers", 1.0f ); // singleplayer

	EngFuncs::PlayBackgroundTrack( NULL, NULL );

	EngFuncs::ClientCmd( false, "hazardcourse\n" );
}

void CMenuMain::_Init( void )
{
	if( gMenu.m_gameinfo.trainmap[0] && stricmp( gMenu.m_gameinfo.trainmap, gMenu.m_gameinfo.startmap ) != 0 )
		bTrainMap = true;
	else bTrainMap = false;

	if( EngFuncs::GetCvarFloat( "host_allow_changegame" ))
		bCustomGame = true;
	else bCustomGame = false;

	// console
	console.SetNameAndStatus( L( "GameUI_Console" ), NULL );
	console.iFlags |= QMF_NOTIFY;
	console.SetPicture( PC_CONSOLE );
	console.SetVisibility( gpGlobals->developer );
	SET_EVENT_MULTI( console.onReleased,
	{
		UI_SetActiveMenu( false );
		EngFuncs::KEY_SetDest( KEY_CONSOLE );
	});

	resumeGame.SetNameAndStatus( XL( "Resume game", "Вернуться в игру", "O'yinga qaytish" ), NULL );
	resumeGame.SetPicture( PC_RESUME_GAME );
	resumeGame.iFlags |= QMF_NOTIFY;
	resumeGame.onReleased = UI_CloseMenu;

	disconnect.SetNameAndStatus( XL( "Disconnect", "Отключиться", "Serverdan chiqish" ), NULL );
	disconnect.SetPicture( PC_DISCONNECT );
	disconnect.iFlags |= QMF_NOTIFY;
	disconnect.onReleased = VoidCb( &CMenuMain::DisconnectDialogCb );

	newGame.SetNameAndStatus( XL( "Play with bots", "Игра с ботами", "Botlar bilan o'ynash" ), NULL );
	newGame.SetPicture( PC_NEW_GAME );
	newGame.iFlags |= QMF_NOTIFY;
	newGame.onReleased = UI_CreateGame_Menu;

	hazardCourse.SetNameAndStatus( L( "GameUI_TrainingRoom" ), L( "StringsList_190" ) );
	hazardCourse.SetPicture( PC_HAZARD_COURSE );
	hazardCourse.iFlags |= QMF_NOTIFY;
	hazardCourse.onReleasedClActive = VoidCb( &CMenuMain::HazardCourseDialogCb );
	hazardCourse.onReleased = VoidCb( &CMenuMain::HazardCourseCb );

	multiPlayer.SetNameAndStatus( XL( "Servers", "Серверы", "Serverlar" ), NULL );
	multiPlayer.SetPicture( PC_MULTIPLAYER );
	multiPlayer.iFlags |= QMF_NOTIFY;
	multiPlayer.onReleased = UI_InternetGames_Menu;

	configuration.SetNameAndStatus( XL( "Settings", "Настройки", "Sozlamalar" ), NULL );
	configuration.SetPicture( PC_CONFIG );
	configuration.iFlags |= QMF_NOTIFY;
	configuration.onReleased = UI_Options_Menu;

	saveRestore.iFlags |= QMF_NOTIFY;

	customGame.SetNameAndStatus( L( "GameUI_ChangeGame" ), L( "StringsList_530" ) );
	customGame.SetPicture( PC_CUSTOM_GAME );
	customGame.iFlags |= QMF_NOTIFY;
	customGame.onReleased = UI_CustomGame_Menu;

	// TODO: add readme screen later
	// X CLIENT: "Tezkor o'yin" - eng yaxshi serverga darhol kirish
	readme.SetNameAndStatus( XL( "Quick play", "Быстрая игра", "Tezkor o'yin" ), NULL );
	readme.iFlags |= QMF_NOTIFY;
	readme.onReleased.SetCommand( false, "exec boosttop_random.cfg\n" );

	previews.SetNameAndStatus( L( "Previews" ), L( "StringsList_400" ) );
	previews.SetPicture( PC_PREVIEWS );
	previews.iFlags |= QMF_NOTIFY;
	SET_EVENT( previews.onReleased, EngFuncs::ShellExecute( MenuStrings[ IDS_MEDIA_PREVIEWURL ], NULL, false ) );

	quit.SetNameAndStatus( XL( "Quit", "Выход", "Chiqish" ), NULL );
	quit.SetPicture( PC_QUIT );
	quit.iFlags |= QMF_NOTIFY;
	quit.onReleased = VoidCb( &CMenuMain::QuitDialogCb );

	quitButton.SetPicture( ART_CLOSEBTN_N, ART_CLOSEBTN_F, ART_CLOSEBTN_D );
	quitButton.iFlags = QMF_MOUSEONLY;
	quitButton.eFocusAnimation = QM_HIGHLIGHTIFFOCUS;
	quitButton.onReleased = VoidCb( &CMenuMain::QuitDialogCb );

	minimizeBtn.SetPicture( ART_MINIMIZE_N, ART_MINIMIZE_F, ART_MINIMIZE_D );
	minimizeBtn.iFlags = QMF_MOUSEONLY;
	minimizeBtn.eFocusAnimation = QM_HIGHLIGHTIFFOCUS;
	minimizeBtn.onReleased.SetCommand( false, "minimize\n" );



	if ( gMenu.m_gameinfo.gamemode == GAME_SINGLEPLAYER_ONLY )
		multiPlayer.SetGrayed( true );

	// if ( gMenu.m_gameinfo.gamemode == GAME_MULTIPLAYER_ONLY )
	// {
	// 	saveRestore.SetGrayed( true );
	// 	hazardCourse.SetGrayed( true );
	// }

	// too short execute string - not a real command
	if( strlen( MenuStrings[IDS_MEDIA_PREVIEWURL] ) <= 3 )
	{
		previews.SetGrayed( true );
	}

	// server.dll needs for reading savefiles or startup newgame
	if( !EngFuncs::CheckGameDll( ))
	{
		saveRestore.SetGrayed( true );
		hazardCourse.SetGrayed( true );
		newGame.SetGrayed( true );
	}

	if( FBitSet( gMenu.m_gameinfo.flags, GFL_ANIMATED_TITLE ))
	{
		if( animatedBanner.TryLoad())
			AddItem( animatedBanner );
	}
	else
	{
		AddItem( movieBanner );
	}

	dialog.Link( this );

	AddItem( banner );
	AddItem( console );
	AddItem( disconnect );
	AddItem( resumeGame );
	AddItem( newGame );



	AddItem( configuration );
	AddItem( multiPlayer );



	AddItem( readme );
	AddItem( quit );
	AddItem( minimizeBtn );
	AddItem( quitButton );
}

/*
=================
UI_Main_Init
=================
*/
void CMenuMain::VidInit( bool connected )
{
	int hoffset = ( 70 / 640.0 ) * 1024.0;

	// in original menu Previews is located at specific point
	int previews_voffset = ( 404 / 480.0 ) * 768.0;

	// no visible console button gap
	int ygap = (( 404 - 373 ) / 480.0 ) * 768.0;

	// statically positioned items
	minimizeBtn.SetRect( uiStatic.width - 72, 13, 32, 32 );
	quitButton.SetRect( uiStatic.width - 36, 13, 32, 32 );

	// X CLIENT: yuqoridan pastga - Tezkor o'yin, Serverlar, Botlar bilan, Sozlamalar, Chiqish
	bool single = gpGlobals->maxClients < 2;
	int yoffset = previews_voffset + ygap;
	quit.SetCoord( hoffset, yoffset ); yoffset -= ygap;
	configuration.SetCoord( hoffset, yoffset ); yoffset -= ygap;
	newGame.SetCoord( hoffset, yoffset ); yoffset -= ygap;
	multiPlayer.SetCoord( hoffset, yoffset ); yoffset -= ygap;
	readme.SetCoord( hoffset, yoffset ); yoffset -= ygap;
	if( connected )
	{
		if( !single ) { disconnect.SetCoord( hoffset, yoffset ); yoffset -= ygap; }
		resumeGame.SetCoord( hoffset, yoffset ); yoffset -= ygap;
	}
	console.SetCoord( hoffset, yoffset );

	// now figure out what's visible
	resumeGame.SetVisibility( connected );
	disconnect.SetVisibility( connected && !single );

	newGame.SetVisibility( true );

	if( connected && single )
	{
		saveRestore.SetNameAndStatus( L( "Save\\Load Game" ), L( "StringsList_192" ) );
		saveRestore.SetPicture( PC_SAVE_LOAD_GAME );
		saveRestore.onReleased = UI_SaveLoad_Menu;
	}
	else
	{
		saveRestore.SetNameAndStatus( L( "GameUI_LoadGame" ), L( "StringsList_191" ) );
		saveRestore.SetPicture( PC_LOAD_GAME );
		saveRestore.onReleased = UI_LoadGame_Menu;
	}
}

void CMenuMain::_VidInit()
{
	VidInit( CL_IsActive() );
}

void CMenuMain::Think()
{
	if( gpGlobals->developer )
	{
		if( !console.IsVisible( ))
			console.Show();
	}
	else
	{
		if( console.IsVisible( ))
			console.Hide();
	}

	CMenuFramework::Think();
}

ADD_MENU( menu_main, CMenuMain, UI_Main_Menu );

/*
=================
UI_QuitDialog_f

called by the engine when the OS asks to quit (window close button, Cmd+Q on macOS...)
=================
*/
static void UI_QuitDialog_f( void )
{
	// nothing to lose, quit immediately
	if( !CL_IsActive( ))
	{
		EngFuncs::ClientCmd( false, "quit \"menu\"\n" );
		return;
	}

	if( !UI_IsVisible( ))
		UI_Main_Menu();

	menu_main->QuitDialogCb();
}
ADD_COMMAND( menu_quit, UI_QuitDialog_f );
