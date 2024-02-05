FROM node:20-alpine3.11

WORKDIR /usr/staff-fm/src

COPY package.json /usr/staff-fm
COPY yarn.lock /usr/staff-fm
RUN npm install -g yarn@1.22.21
RUN yarn -v
RUN yarn install

ADD src /usr/staff-fm/src
COPY tsconfig.json /usr/staff-fm

RUN yarn build

CMD [ "yarn", "start" ]