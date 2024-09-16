#!/usr/bin/env bash

cd "$(dirname "$(readlink -f "$0")")"

function update-po() {
	echo '' > messages.po
	[ "$?" != "0" ] && echo "update-po: Unable to create ./messages.po file" && return 1

	which xgettext 2>/dev/null >/dev/null
	[ "$?" != "0" ] && echo "update-po: xgettext is not installed on this system. please install and try again" && return 1

    find ./src -type f \( -name "*.ui" -or -name "*.js" \) | xgettext --from-code utf-8 -j messages.po -f -
	[ "$?" != "0" ] && echo "update-po: Unable to update messages.po file by xgettext" && return 1

    sed -i 's|"Content\-Type: text/plain; charset=CHARSET\\n"|"Content-Type: text/plain; charset=UTF-8\\n"|g' messages.po
	[ "$?" != "0" ] && echo "update-po: Unable to set charset in messages.po file" && return 1

    find ./po -type f -name "*.po" | xargs -i msgmerge {} messages.po -N --no-wrap -U
	[ "$?" != "0" ] && echo "update-po: Failed to update *.po files (msgmerge error)" && return 1

    mv messages.po $(find ./po -type f -name "*.pot")
	[ "$?" != "0" ] && echo "update-po: Unable to move messages.po file (pot file not found)" && return 1

	return 0
}

function compile-preferences() {
	glib-compile-schemas --targetdir=src/schemas src/schemas
	[ "$?" != "0" ] && echo "compile-preferences: glib-compile-schemas command failed" && return 1

	return 0
}

function build() {
	compile-preferences
	[ "$?" != "0" ] && echo "Failed to compile preferences" && return 1

	mkdir dist -p
	gnome-extensions pack src\
		--extra-source=../LICENSE\
		--extra-source=../LICENSE-gnome-volume-mixer\
		--extra-source=features\
		--extra-source=libs\
		--extra-source=prefPages\
		--extra-source=media\
		--extra-source=contributors\
		--podir=../po\
		--out-dir=dist\
		--force
	[ "$?" != "0" ] && echo "Failed to pack extension" && return 1

	return 0
}

function enable() {
	gnome-extensions enable quick-settings-tweaks@qwreey
}

function install() {
	build
	[ "$?" != "0" ] && return 1

	gnome-extensions install\
		dist/quick-settings-tweaks@qwreey.shell-extension.zip\
		--force
	[ "$?" != "0" ] && echo "Failed to install extension" && return 1
	echo "Extension was installed. logout and login shell, and check extension list."

	return 0
}

function dev-xorg() {
	build
	echo "Warn: Dev hot reload (restarting) only works on unsafe mode"
	if [[ "$XDG_SESSION_TYPE" == "x11" ]]; then
		busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting…", global.context)'
	else
		echo "Session is not x11 ($XDG_SESSION_TYPE). this session not supports hot reloading. you should logout and login shell again for apply changes"
	fi
}

function log() {
	journalctl /usr/bin/gnome-shell -f -q --output cat | grep '\[EXTENSION QSTweaks\] '
}

function clear-old-po() {
	rm ./po/*.po
}

function dev() {
	mkdir -p host
	CURTAG=""
	if [ -e "./host/gnome-docker" ]; then
		CURTAG="$(git -C host/gnome-docker describe --tags --always --abbrev=0 HEAD)"
	else
		git clone https://github.com/qwreey/gnome-docker host/gnome-docker --recursive
	fi

	TARTAG="$(cat gnome-docker-version)"
	if [[ "$CURTAG" != "$TARTAG" ]]; then
		git -C host/gnome-docker pull origin master --tags
		git -C host/gnome-docker checkout "$TARTAG"
	fi

	./host/gnome-docker/test.sh
}

function usage() {
    echo 'Usage: ./install.sh COMMAND'
    echo 'COMMAND:'
    echo "  install       install the extension in the user's home directory"
    echo '                under ~/.local'
    echo '  build         Creates a zip file of the extension'
    echo '  update-po     Update po files to match source files'
	echo '  dev-xorg      Update installed extension and reload gnome shell.'
	echo '                only works on x11 unsafe mode.'
	ecoh '  dev           Run dev docker'
	echo '  log           show extension logs (live)'
	echo '  clear-old-po  clear *.po~'
	echo '  enable        enable extension'
}

case "$1" in
    "install" )
        install
    ;;

	"build" )
		build
	;;

	"log" )
		log
	;;

    "dev-xorg" )
        dev-xorg
    ;;

    "update-po" )
        update-po
    ;;

	"clear-old-po" )
		clear-old-po
	;;

	"enable" )
		enable
	;;

	"dev" )
		dev
	;;
    
    * )
        usage
    ;;
esac
exit
