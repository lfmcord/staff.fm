# staff.fm
staff.fm is a custom moderation and server management bot for Lastcord.

## Development Setup
![node-shield]
![docker-shield]
![docker-compose-shield]

<!-- Image Definitions -->
[docker-shield]: https://img.shields.io/badge/docker->=24.0.7-blue?style=flat&logo=docker
[docker-compose-shield]: https://img.shields.io/badge/docker--compose->=v2.23.3-blue?style=flat&logo=docker
[node-shield]: https://img.shields.io/badge/node--lts-v20.11.0-blue?style=flat&logo=nodedotjs

1. Copy the `.env.example` file, call it `.env` and replace the values in brackets `[]`.
2. Install yarn dependencies
    ```shell
    yarn install
    ```

3. Run the databases

    ```shell
    docker-compose up -d staff-fm-mongodb
    ```

4. Run the bot
    ```shell
    yarn start
    ```

    With Live Reload:
    
   ```shell
    yarn watch
    ```
   

