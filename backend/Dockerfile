FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG APP=backend
ENV APP=${APP}

CMD npx nest start $APP --watch
