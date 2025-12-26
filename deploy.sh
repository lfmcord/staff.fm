ssh-agent bash -c 'ssh-add ~/.ssh/id_rsa_stafffm; git fetch'
ssh-agent bash -c 'ssh-add ~/.ssh/id_rsa_stafffm; git pull -f'

docker compose pull
docker compose up -d --build