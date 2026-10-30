# Haunted Court : serveur Node + git, avec le dépôt de démonstration cloné à la construction.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
# Dépôt jugé par défaut (code tiers, licence BSD) : cloné ici, jamais commité dans ce dépôt.
RUN git clone -q https://github.com/bread-and-pepper/django-userena demo/django-userena \
 && mkdir -p verdicts && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=3000 HC_PUBLIC=1
EXPOSE 3000
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
