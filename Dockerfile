FROM python:3.13-slim
WORKDIR /AudioPleer
COPY pip.txt .
RUN pip install --no-cache-dir -r pip.txt && rm pip.txt
COPY . .
CMD ["waitress-serve", "--listen=0.0.0.0:80", "AudioPleer.wsgi:application"]
