# Stage 1: Build Go binary
FROM golang:1.25.4-alpine3.22 AS builder

# gosseract uses CGO to link against libtesseract
RUN apk --no-cache add git gcc g++ tesseract-ocr-dev

WORKDIR /ocrserver
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 go build -o ocrserver .

# Stage 2: Final image with Tesseract
FROM alpine:latest

ARG LOAD_LANG=eng

RUN apk --no-cache add ca-certificates tesseract-ocr

# Load languages
RUN if [ -n "${LOAD_LANG}" ]; then apk --no-cache add tesseract-ocr-data-${LOAD_LANG}; fi

WORKDIR /app
COPY --from=builder /ocrserver/ocrserver ./

RUN chmod +x ./ocrserver
ENV PORT=8080
ENTRYPOINT ["./ocrserver"]
