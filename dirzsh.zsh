$ID:load() {
    lib:path-alloc2 "PATHALLOC_$ID" ./scripts :
    alias execute="ID=$ID $ID:execute"
    alias lg="ID=$ID $ID:lg"
    alias dbus-docker="ID=$ID $ID:dbus-docker"
    alias notify="ID=$ID $ID:notify"
    alias notify-test="ID=$ID $ID:notify-test"
    alias prefs="ID=$ID $ID:prefs"
}

$ID:unload() {
    lib:path-free "PATHALLOC_$ID"
    unalias execute
    unalias lg
    unalias dbus-docker
    unalias notify
    unalias notify-test
    unalias prefs
}

$ID:execute() {
    if [ -e ./host/vncready ]; then
        sudo docker compose exec -u gnome gnome-docker env DISPLAY=":0" DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus gdbus call -e -d org.gnome.Shell -o /org/gnome/Shell -m org.gnome.Shell.Eval "$1"
    else
        gdbus call -e -d org.gnome.Shell -o /org/gnome/Shell -m org.gnome.Shell.Eval "$1"
    fi
}
$ID:dbus-docker() {
    sudo docker compose exec -u gnome gnome-docker env DISPLAY=":0" DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus $@
}
$ID:lg() {
     $ID:execute "Main.createLookingGlass().toggle()"
}
$ID:notify() {
    if [ -e ./host/vncready ]; then
        $ID:dbus-docker notify-send $@
    else
        notify-send $@
    fi
}
$ID:notify-test() {
    $ID:notify test testmessage -u normal -t 0
}
$ID:prefs() {
    if [ -e ./host/vncready ]; then
        $ID:dbus-docker gnome-extensions prefs quick-settings-tweaks@qwreey
    else
        gnome-extensions prefs quick-settings-tweaks@qwreey
    fi
}
