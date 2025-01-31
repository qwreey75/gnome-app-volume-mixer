#!/usr/bin/env bash
cd "$(dirname "$(readlink -f "$0")")"

function update-po() {
	build

	echo '' > messages.po
	[ "$?" != "0" ] && echo "update-po: Unable to create ./messages.po file" && return 1

	which xgettext 2>/dev/null >/dev/null
	[ "$?" != "0" ] && echo "update-po: xgettext is not installed on this system. please install and try again" && return 1

	find ./target/out -type f \( -name "*.ui" -or -name "*.js" \) | xgettext --from-code utf-8 -j messages.po -f -
	[ "$?" != "0" ] && echo "update-po: Unable to update messages.po file by xgettext" && return 1

	sed -i 's|"Content\-Type: text/plain; charset=CHARSET\\n"|"Content-Type: text/plain; charset=UTF-8\\n"|g' messages.po
	[ "$?" != "0" ] && echo "update-po: Unable to set charset in messages.po file" && return 1

	find ./po -type f -name "*.po" | xargs -i msgmerge {} messages.po -N --no-wrap -U
	[ "$?" != "0" ] && echo "update-po: Failed to update *.po files (msgmerge error)" && return 1

	mv messages.po $(find ./po -type f -name "*.pot")
	[ "$?" != "0" ] && echo "update-po: Unable to move messages.po file (pot file not found)" && return 1

	return 0
}

function fetch-contributors() {
	LABELS=$(cat scripts/contributor-labels.json)
	echo "["
	FIRST="1"
	curl -Ls "https://api.github.com/repos/qwreey/quick-settings-tweaks/contributors?per_page=16&page=1" | while read line; do
		if echo $line | grep -oP '^ *{ *$' > /dev/null; then
			[ "$FIRST" = "0" ] && echo -e "\t},"
			FIRST="0"
			echo -e "\t{"
		fi

		if NAME=$(echo $line | grep -oP '(?<="login": ").*(?=")'); then
			USER_LABEL=$(printf "%s" "$LABELS" | grep -oP "(?<=\"$NAME\": \").*(?=\")")
			echo -e "\t\t\"name\": \"$NAME\","
			echo -e "\t\t\"image\": \"$NAME\","
			echo -en "\t\t"
			echo "\"label\": \"${USER_LABEL:-ETC}\","
			curl -Lso target/contributors/$NAME.png "https://github.com/$NAME.png?size=38"
		fi
		if HOMEPAGE=$(echo $line | grep -oP '(?<="html_url": ").*(?=")'); then
			echo -e "\t\t\"link\": \"$HOMEPAGE\""
		fi
	done
	echo -e "\t}"
	echo "]"
}

function build() {
	rm -rf target/out
	mkdir -p target/out

	# Typescript compiling
	(
		npx tsc --noCheck
		cp -r target/tsc/* target/out
	) &
	TSC_PID=$!

	# Stylesheet compiling
	(
		npx sass\
			--no-source-map\
			src/stylesheet.scss:target/out/stylesheet.css
		sed $'s/^  /\t/g' -i target/out/stylesheet.css
	) &
	SASS_PID=$!

	# Fetch contributors & Copy assets
	(
		if [ ! -e target/contributors ]; then
			mkdir -p target/contributors
			fetch-contributors > target/contributors/data.json
		fi
		cp metadata.json target/out
		cp -r schemas target/out
		cp -r media target/out
		cp -r target/contributors target/out/media
	) &
	COPYING_PID=$!

	# Wait for tasks
	wait $TSC_PID
	wait $SASS_PID
	wait $COPYING_PID

	# Update config metadata
	case "$TARGET" in
		dev )
			sed 's/isDevelopmentBuild: false/isDevelopmentBuild: true/' -i target/out/config.js
		;;
		preview )
		;;
		release )
			sed 's/isReleaseBuild: false/isReleaseBuild: true/' -i target/out/config.js
		;;
		github-release )
			sed 's/isReleaseBuild: false/isReleaseBuild: true/' -i target/out/config.js
			sed 's/isGithubBuild: false/isGithubBuild: true/' -i target/out/config.js
		;;
		github-preview )
			sed 's/isGithubBuild: false/isGithubBuild: true/' -i target/out/config.js
		;;
	esac
	if [ -z "$VERSION" ]; then
		VERSION=$(git branch --show-current)
	fi
	sed "s/version: \"unknown\"/version: \"$VERSION\"/" -i target/out/config.js
	[ ! -z "$BUILD_NUMBER" ] && sed "s/buildNumber: 0/buildNumber: $BUILD_NUMBER/" -i target/out/config.js

	# Change indents for reducing size of target
	node scripts/reindent.js -- target/out/**/*.js

	# Pack extension
	gnome-extensions pack target/out\
		--podir=../../po\
		--extra-source=../../LICENSE\
		--extra-source=../../LICENSE-gnome-volume-mixer\
		--extra-source=features\
		--extra-source=libs\
		--extra-source=prefPages\
		--extra-source=media\
		--extra-source=global.js\
		--extra-source=config.js\
		--out-dir=target\
		--force
	[ "$?" != "0" ] && echo "Failed to pack extension" && return 1

	return 0
}

function enable() {
	gnome-extensions enable quick-settings-tweaks@qwreey
}

function install() {
	gnome-extensions install\
		target/quick-settings-tweaks@qwreey.shell-extension.zip\
		--force
	[ "$?" != "0" ] && echo "Failed to install extension" && return 1
	echo "Extension was installed. logout and login shell, and check extension list."

	return 0
}

function log() {
	journalctl /usr/bin/gnome-shell -f -q --output cat | grep '\[EXTENSION QSTweaks\] '
}

function clear-old-po() {
	rm ./po/*.po~
}

function compile-preferences() {
	glib-compile-schemas --targetdir=target/out/schemas schemas
	[ "$?" != "0" ] && echo "compile-preferences: glib-compile-schemas command failed" && return 1

	return 0
}

function increase-middle-version() {
	echo $(( $(cat scripts/version/latest-middle-version) + 1 )) > scripts/version/latest-middle-version
	echo $(( $(cat scripts/version/latest-build-number) + 1 )) > scripts/version/latest-build-number
	echo 1 > scripts/version/latest-minor-version
}
function increase-minor-version() {
	echo $(( $(cat scripts/version/latest-build-number) + 1 )) > scripts/version/latest-build-number
	echo $(( $(cat scripts/version/latest-minor-version) + 1 )) > scripts/version/latest-minor-version
}

function create-release() {
	VERSION_MAJOR=$(cat scripts/version/major-version)
	VERSION_MIDDLE=$(cat scripts/version/latest-middle-version)
	VERSION_MINOR=$(cat scripts/version/latest-minor-version)
	BUILD_NUMBER=$(cat scripts/version/latest-build-number)
	VERSION_TAG=""
	case "$TARGET" in
		dev )
			VERSION_TAG="-dev$VERSION_MINOR"
		;;
		preview )
			VERSION_TAG="-pre$VERSION_MINOR"
		;;
		release )
			VERSION_TAG=""
		;;
		github-release )
			VERSION_TAG=""
		;;
		github-preview )
			VERSION_TAG="-pre$VERSION_MINOR"
		;;
	esac
	VERSION="$VERSION_MAJOR.$VERSION_MIDDLE$VERSION_TAG"
	VERSION=$VERSION BUILD_NUMBER=$BUILD_NUMBER build
	cp target/quick-settings-tweaks@qwreey.shell-extension.zip target/$VERSION-$TARGET.zip
}

function dev() {
	if ! sudo echo > /dev/null; then
		return
	fi
	mkdir -p host
	[ -e host/extension-ready ] && rm host/extension-ready
	mkfifo host/extension-ready
	[ -e host/extension-build ] && rm host/extension-build
	mkfifo host/extension-build

	# Build
	(
		TARGET="${TARGET:-dev}" create-release
		echo > host/extension-ready
	) &

	# Watch Build Request
read -d '' INNER_BUILDWATCH << EOF
	cat host/extension-build > /dev/null
	while true; do
		cat host/extension-build > /dev/null
		if [ ! -e host/vncready ]; then
			break
		fi
		TARGET="\${TARGET:-dev}" create-release
		echo > host/extension-ready
	done
EOF
	setsid bash -c "$INNER_BUILDWATCH" &
	BUILDWATCH_PID=$!

	[ ! -e ./docker-compose.yml ] && cp ./docker-compose.example.yml ./docker-compose.yml

	CURTAG=""
	if [ -e "./host/gnome-docker" ]; then
		CURTAG="$(git -C host/gnome-docker describe --tags --always --abbrev=0 HEAD)"
	else
		git clone https://github.com/qwreey/gnome-docker host/gnome-docker --recursive --tags
	fi

	TARTAG="$(cat scripts/version/gnome-docker-version)"
	if [[ "$CURTAG" != "$TARTAG" ]]; then
		git -C host/gnome-docker pull origin master --tags
		git -C host/gnome-docker submodule update
		git -C host/gnome-docker checkout "$TARTAG"
		sudo docker compose -f ./docker-compose.yml build
	fi

	COMPOSEFILE="./docker-compose.yml" ./host/gnome-docker/test.sh
	rm host/extension-build host/extension-ready
	kill $BUILDWATCH_PID 2> /dev/null
	wait $BUILDWATCH_PID
	exit 0
}

function dev-guest() {
	echo > /host/extension-build
	cat /host/extension-ready > /dev/null
	install
	enable
}

function usage() {
	echo 'Usage: ./install.sh COMMAND'
	echo 'COMMAND:'
	echo "  install             install the extension in the user's home directory"
	echo '                      under ~/.local'
	echo '  build               Creates a zip file of the extension'
	echo '  update-po           Update po files to match source files'
	echo '  dev                 Run dev docker'
	echo '  log                 show extension logs (live)'
	echo '  clear-old-po        clear *.po~'
	echo '  enable              enable extension'
	echo '  install-enable      install and enable'
	echo '  compile-preferences compile schema file (test)'
}

case "$1" in
	"install" )
		install
	;;

	"install-enable" )
		install
		enable
	;;

	"build" )
		build
	;;

	"log" )
		log
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
	"dev-guest" )
		dev-guest
	;;
	
	"compile-preferences")
		compile-preferences
	;;

	"increase-minor-version")
		increase-minor-version
	;;

	"increase-middle-version")
		increase-middle-version
	;;

	"create-release")
		create-release
	;;

	* )
		usage
	;;
esac
exit
