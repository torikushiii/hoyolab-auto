FROM node:20-alpine

WORKDIR /app

COPY ["package.json", "./"]
RUN npm i

COPY ["./", "./"]

RUN mkdir -p /app/data

RUN chown -R node:node /app

USER node

ENV TZ=Asia/Shanghai

CMD ["npm", "start"]
