#!/bin/bash
O=$PWD/diag/out; mkdir -p $O/nc; : > $O/summary.txt
W=/c/cs16tmp; mkdir -p $W
gh release download cs16 --repo jamic2922220-alt/xclient-pc -p 'CS_1_6_boost-top_PRO_2_5_3.exe' -D $W 2>&1 | tail -1
cmd //c "C:\\cs16tmp\\CS_1_6_boost-top_PRO_2_5_3.exe /VERYSILENT /SP- /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS=\"\" /DIR=C:\\csgame"
G=/c/csgame
for f in cstrike/resource/OptionsSubVideo.res cstrike/resource/VideoAvancedDialog.res cstrike/resource/nextclient_russian.txt cstrike/resource/nextclient_english.txt cstrike/config.cfg cstrike/userconfig.cfg cstrike/autoexec.cfg cstrike/video.cfg platform/config/config.cfg cstrike/nextclient.cfg cstrike/next.cfg; do
  [ -f "$G/$f" ] && cp "$G/$f" "$O/nc/$(echo $f | tr / _)" && echo "ok $f" >> $O/summary.txt
done
ls $G/cstrike/*.cfg $G/platform/config 2>/dev/null >> $O/summary.txt
find $G/cstrike -maxdepth 2 -iname "client.dll" >> $O/summary.txt
for f in $(find $G/cstrike -maxdepth 2 -iname "client.dll"); do strings -a -n 4 "$f" | grep -E "^[a-z_]{3,40}$" | grep -E "^(cl_|hud_|fov|gl_|r_|vid_|nc_|next_|m_|_)" | sort -u > $O/nc/client.cvars.txt; done
