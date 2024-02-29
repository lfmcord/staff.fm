FROM node:20-alpine

WORKDIR /usr/staff-fm/src

COPY package.json /usr/staff-fm
COPY yarn.lock /usr/staff-fm
RUN yarn -v
RUN yarn install

ADD src /usr/staff-fm/src
COPY tsconfig.json /usr/staff-fm

RUN yarn build

CMD [ "yarn", "start" ]