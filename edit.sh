#!/data/data/com.termux/files/usr/bin/bash
# edit.sh — Edit file di Termux tanpa nano/vim
# Usage:
#   ./edit.sh show <file> <start> <end>          → tampilkan baris range
#   ./edit.sh find <file> <pattern>              → cari baris yang cocok
#   ./edit.sh del <file> <pattern>               → hapus baris yang cocok
#   ./edit.sh del-line <file> <start> <end>      → hapus baris range
#   ./edit.sh replace-line <file> <line> <text>  → ganti isi baris
#   ./edit.sh replace <file> <old> <new>         → replace string (pertama)
#   ./edit.sh replace-all <file> <old> <new>     → replace string (semua)
#   ./edit.sh insert-after <file> <pattern> <text> → sisipkan setelah baris
#   ./edit.sh insert-before <file> <pattern> <text> → sisipkan sebelum baris

set -e
ACTION="$1"
FILE="$2"

if [ -z "$ACTION" ] || [ -z "$FILE" ]; then
  echo "Usage: ./edit.sh <action> <file> [args]"
  echo "Actions: show, find, del, del-line, replace-line, replace, replace-all, insert-after, insert-before"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "❌ File gak ada: $FILE"
  exit 1
fi

# Auto-backup sebelum modifikasi
backup() {
  cp "$FILE" "$FILE.bak-$(date +%s)"
  echo "💾 Backup: $FILE.bak-$(date +%s)"
}

case "$ACTION" in
  show)
    START="${3:-1}"
    END="${4:-50}"
    sed -n "${START},${END}p" "$FILE"
    ;;

  find)
    PATTERN="$3"
    grep -n "$PATTERN" "$FILE"
    ;;

  del)
    PATTERN="$3"
    backup
    sed -i "/$PATTERN/d" "$FILE"
    echo "✅ Hapus baris yang cocok: $PATTERN"
    ;;

  del-line)
    START="$3"
    END="$4"
    backup
    sed -i "${START},${END}d" "$FILE"
    echo "✅ Hapus baris $START-$END"
    ;;

  replace-line)
    LINE="$3"
    TEXT="$4"
    backup
    sed -i "${LINE}s|.*|${TEXT}|" "$FILE"
    echo "✅ Baris $LINE diganti"
    ;;

  replace)
    OLD="$3"
    NEW="$4"
    backup
    python3 -c "
import sys
with open('$FILE', 'r') as f: c = f.read()
c = c.replace('''$OLD''', '''$NEW''', 1)
with open('$FILE', 'w') as f: f.write(c)
print('✅ Replace (1x) selesai')
"
    ;;

  replace-all)
    OLD="$3"
    NEW="$4"
    backup
    python3 -c "
with open('$FILE', 'r') as f: c = f.read()
n = c.count('''$OLD''')
c = c.replace('''$OLD''', '''$NEW''')
with open('$FILE', 'w') as f: f.write(c)
print(f'✅ Replace {n}x selesai')
"
    ;;

  insert-after)
    PATTERN="$3"
    TEXT="$4"
    backup
    python3 -c "
with open('$FILE', 'r') as f: lines = f.readlines()
out = []
for line in lines:
    out.append(line)
    if '''$PATTERN''' in line:
        out.append('''$TEXT''' + '\n')
with open('$FILE', 'w') as f: f.writelines(out)
print('✅ Insert after: $PATTERN')
"
    ;;

  insert-before)
    PATTERN="$3"
    TEXT="$4"
    backup
    python3 -c "
with open('$FILE', 'r') as f: lines = f.readlines()
out = []
for line in lines:
    if '''$PATTERN''' in line:
        out.append('''$TEXT''' + '\n')
    out.append(line)
with open('$FILE', 'w') as f: f.writelines(out)
print('✅ Insert before: $PATTERN')
"
    ;;

  *)
    echo "❌ Action gak dikenal: $ACTION"
    echo "Pilihan: show, find, del, del-line, replace-line, replace, replace-all, insert-after, insert-before"
    exit 1
    ;;
esac
