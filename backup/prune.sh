#!/bin/sh
# Keep the newest backup of each of the last RETAIN_DAILY days, RETAIN_WEEKLY weeks
# and RETAIN_MONTHLY months; delete the rest.
set -eu
DIR="$1"
: "${RETAIN_DAILY:=14}" "${RETAIN_WEEKLY:=8}" "${RETAIN_MONTHLY:=12}"

keep=""; days=""; weeks=""; months=""
nd=0; nw=0; nm=0
for f in $(ls -1 "$DIR" | grep -E '^clinicdb-[0-9]{8}-[0-9]{6}\.tar\.age$' | sort -r); do
  d=$(echo "$f" | cut -c10-17)
  iso="$(echo "$d" | cut -c1-4)-$(echo "$d" | cut -c5-6)-$(echo "$d" | cut -c7-8)"
  w=$(date -d "$iso" +%G-%V)
  m=$(echo "$d" | cut -c1-6)
  k=0
  case " $days " in *" $d "*) ;; *) if [ $nd -lt "$RETAIN_DAILY" ]; then days="$days $d"; nd=$((nd+1)); k=1; fi ;; esac
  case " $weeks " in *" $w "*) ;; *) if [ $nw -lt "$RETAIN_WEEKLY" ]; then weeks="$weeks $w"; nw=$((nw+1)); k=1; fi ;; esac
  case " $months " in *" $m "*) ;; *) if [ $nm -lt "$RETAIN_MONTHLY" ]; then months="$months $m"; nm=$((nm+1)); k=1; fi ;; esac
  if [ $k -eq 0 ]; then rm -f "$DIR/$f"; echo "pruned $f"; fi
done
