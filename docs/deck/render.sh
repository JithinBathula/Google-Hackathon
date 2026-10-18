#!/bin/zsh
# usage: render.sh <svg dir> <png dir>
for n in process-flow architecture wireframes; do
  h=800; [ "$n" = wireframes ] && h=680
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=2 --window-size=1800,$h --screenshot="$2/$n.png" "file://$1/$n.svg" >/dev/null 2>&1
done
