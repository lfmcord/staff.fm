ssh-agent bash -c 'ssh-add ~/.ssh/id_rsa_stafffm; git fetch'
ssh-agent bash -c 'ssh-add ~/.ssh/id_rsa_stafffm; git pull -f'

docker compose build
docker compose up -d