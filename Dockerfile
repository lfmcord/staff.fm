FROM node:20-alpine

WORKDIR /usr/staff-fm/src

COPY package.json /usr/staff-fm
RUN yarn -v
RUN npm install

ADD src /usr/staff-fm/src
COPY tsconfig.json /usr/staff-fm
COPY .env /usr/staff-fm

RUN npm run build

CMD [ "npm", "start" ]