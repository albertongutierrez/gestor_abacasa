#!/usr/bin/env bash
# Run on the hosting, not on a shared computer. Only the public key is printed.
set -Eeuo pipefail
umask 077
KEY="${HOME}/.ssh/abacasa_github_ed25519"
command -v ssh-keygen >/dev/null || { printf 'Falta ssh-keygen.\n' >&2; exit 1; }
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
if [[ ! -e "$KEY" && ! -e "$KEY.pub" ]]; then
    ssh-keygen -t ed25519 -N '' -C 'gestor-abacasa-hosting-readonly' -f "$KEY"
elif [[ ! -f "$KEY" || ! -f "$KEY.pub" ]]; then
    printf 'Hay una clave incompleta en %s. Revísala manualmente.\n' "$KEY" >&2
    exit 1
fi
chmod 600 "$KEY"
chmod 644 "$KEY.pub"
printf '\nAñade esta clave PÚBLICA en GitHub, sin marcar Allow write access:\n'
cat "$KEY.pub"
printf '\nSettings: https://github.com/albertongutierrez/gestor_abacasa/settings/keys\n'
printf 'Clave privada (conservar en este servidor): %s\n' "$KEY"
printf '\nAntes de conectar, compara la huella del servidor GitHub con https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints\n'
printf 'Clonar con: GIT_SSH_COMMAND="ssh -i %s -o IdentitiesOnly=yes" git clone git@github.com:albertongutierrez/gestor_abacasa.git\n' "$KEY"
