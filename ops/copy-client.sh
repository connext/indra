#!/bin/bash
# STOP! Before going any further, think: are you going to regret the decision
# to write this script?
#     Deciding to write this in bash was not one of my better decisions.
#     -- https://twitter.com/alex_gaynor/status/369892494114164736

set -eu
cd "$(dirname "$0")"

while true; do
    case "${1-}" in
        # Note: add any new directories here to the 'check-client-copies' script
        wallet*)
            dst="../modules/wallet/src/client/"
            exclude=""
            ;;
        hub*)
            dst="../modules/hub/src/vendor/connext/"
            exclude="--exclude controllers/** --exclude testing/** --exclude Connext.ts --exclude lib/currency/** --exclude state/actions.ts --exclude state/reducers.ts --exclude state/middleware.ts"
            ;;
        *)
            echo "USAGE: $0 [hub|wallet]"
            exit 1
    esac

    set -x
    rsync -avl --exclude '*.test.ts' --exclude 'register/**' --exclude 'testing/**' --exclude '.*' ${exclude-} --delete-excluded --prune-empty-dirs ../modules/client/src "$dst"

    # Avoid these lines if not MacOS
    # TODO implement linux equivalent
    unamestr=`uname`
    if [[ "$unamestr" == 'Darwin' ]]; then
      set +x
      find -s "${dst%%/}" -type f -not -name '.*' -exec md5 '{}' ';' | grep -v copy-checksums > "$dst/.copy-checksums"
    fi
    shift
    if [[ "$#" -lt 1 ]]; then
        break
    fi
done
