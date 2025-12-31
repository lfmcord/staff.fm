# staff.fm

staff.fm is a custom moderation and server management bot for Lastcord.

## Features

- **Verification Management**
    - verify command with automatic scrobble role assignment
    - ability to flag malicious accounts and receive alerts if someone wants to verify with a flagged account
    - receive alerts if someone is trying to verify with an already verified user account
    - receive alerts if a last.fm account is especially new
-

## Development Setup

![node-shield]
![docker-shield]
![docker-compose-shield]

<!-- Image Definitions -->

[docker-shield]: https://img.shields.io/badge/docker->=24.0.7-blue?style=flat&logo=docker

[docker-compose-shield]: https://img.shields.io/badge/docker--compose->=v2.23.3-blue?style=flat&logo=docker

[node-shield]: https://img.shields.io/badge/node--lts-v20.11.0-blue?style=flat&logo=nodedotjs

1. Copy the `environment-example.json` file, call it `environment.json` and replace the values with your values.
2. Install yarn dependencies
    ```shell
    yarn install
    ```

3. Run the databases

    ```shell
    docker-compose up -d staff-fm-db staff-fm-redis
    ```

4. Run the bot
    ```shell
    yarn start
    ```

   With Live Reload:

   ```shell
    yarn watch
    ```

## Operations

### Deployment

1. ssh into your server
2. (if first time) run `docker compose volume create stafffm_mongodb` to create the external volume
3. run `sh deploy.sh`

### Database backup

1. (if first time) install the (MongoDB Database Tools)[https://www.mongodb.com/docs/database-tools/installation/]
2. dump the database with
   `mongodump --uri="mongodb://staff-fm-admin:dev-admin@localhost:27018/staff-fm?authSource=admin"`
3. back up the database dump on your host machine with `scp`, e.g.
   `scp -r user@127.0.0.1:~/staff.fm/dump/staff-fm ./backup`

### Database restore

To restore the database, use
   `mongorestore --uri="mongodb://staff-fm-admin:dev-admin@localhost:27018/staff-fm?authSource=admin" ./path/to/dump/staff-fm`

### Database upgrade

If the MongoDB image is for some reason not updating, do the following:

1. Backup the database (see above)
2. Stop and remove the MongoDB container: `docker compose rm -s staff-fm-db`
3. Remove the MongoDB image: `docker rmi mongo`
4. Run `sh deploy.sh` to recreate the container with the latest image
5. Restore the database (see above)