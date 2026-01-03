run_in_parallel() {
  local funcs=("$@")
  local pids=()

  # Start the functions in the background and store their PIDs
  for func in "${funcs[@]}"; do
    ($func) &
    pids+=($!)
  done

  # Wait for all functions and exit if any of them fail
  for pid in "${pids[@]}"; do
    wait $pid || exit $?
  done
}

generate_index_css() {
  echo "/* Auto-generated file */" > dist/index.css
  find dist/esm -name '*.css' -print | sed 's/^dist\/esm\//\@import ".\/esm\//' | sed 's/$/";/' >> dist/index.css
}

ensure_bash_4() {
    # No longer required - scripts are compatible with Bash 3
    :
}

remove_all_css_imports() {
    local directory=$1
    local sed_cmd="sed -i"

    # Check if sed is GNU sed or BSD sed
    if sed --version 2>/dev/null | grep -q GNU; then
        sed_cmd="sed -i"  # GNU sed
    else
        sed_cmd="sed -i ''"  # BSD sed
    fi

    # find "$directory" -type f -name "*.js" -exec bash -c "$sed_cmd \"/require('.\/.*\.css');/d\" {}" \;
    # find "$directory" -type f -name "*.js" -exec bash -c "$sed_cmd \"/require('.\/.*\.css');/d;/import \\\".*\.css\\\";/d\" {}" \;
    find "$directory" -type f -name "*.js" -exec bash -c "$sed_cmd \"/import \\\".*\.css\\\";/d\" {}" \;
}

compile() {
    tsc -p tsconfig.$1.json --outdir ./dist/$1-tmp --declarationDir ./dist/dts-tmp
    # Use find instead of globstar (Bash 3 compatible)
    JS_FILES=$(find dist/$1-tmp -name "*.js" -type f | tr '\n' ' ')
    linaria -r dist/$1-tmp/ -m esnext -o dist/$1-tmp/ $JS_FILES -t -i dist/$1-tmp -c ../../config/linaria.json > /dev/null
    remove_all_css_imports dist/$1-tmp

    # replace dist/$1 (if it exists) with dist/$1-tmp
    if [ -d "dist/$1" ]; then
        mv dist/$1 dist/$1-remove
        rm -rf dist/$1-remove &
    fi
    mv dist/$1-tmp dist/$1

    

    # if it's esm, move the dts folder
    if [ "$2" = true ]; then
        if [ -d "dist/dts" ]; then
            mv dist/dts dist/dts-remove
            rm -rf dist/dts-remove &
        fi
        mv dist/dts-tmp dist/dts
    fi

    rm dist/tsconfig.$1.tsbuildinfo
}