#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "  _____ _ _     _____ _                 "
echo " |_   _(_) | __|  ___| | _____      __ "
echo "   | | | | |/ /| |_  | |/ _ \ \ /\ / / "
echo "   | | | |   < |  _| | | (_) \ V  V /  "
echo "   |_| |_|_|\_\|_|   |_|\___/ \_/\_/   "
echo -e "${NC}"
echo -e "${BOLD}Instalador do TikFlow (Video & Audio Downloader)${NC}"
echo "---------------------------------------------------------"

INSTALL_DIR="$HOME/.local/share/tikflow-downloader"
ZIP_URL="https://github.com/yorrany/tiktok-video-downloader/releases/latest/download/tikflow-v1.0.0.zip"
FALLBACK_ZIP_URL="https://github.com/yorrany/tiktok-video-downloader/raw/main/tikflow-v1.0.0.zip"

echo -e "\n${YELLOW}▶ Preparando diretório de instalação...${NC}"
mkdir -p "$INSTALL_DIR"

TMP_ZIP="/tmp/tikflow-installer.zip"
rm -f "$TMP_ZIP"

echo -e "${YELLOW}▶ Baixando extensão TikFlow...${NC}"
if curl -fSL -o "$TMP_ZIP" "$ZIP_URL" 2>/dev/null; then
    echo -e "${GREEN}✓ Download concluído da Release!${NC}"
elif curl -fSL -o "$TMP_ZIP" "$FALLBACK_ZIP_URL" 2>/dev/null; then
    echo -e "${GREEN}✓ Download concluído do repositório!${NC}"
else
    echo -e "${YELLOW}Baixando via GitHub archive...${NC}"
    curl -fSL -o "$TMP_ZIP" "https://github.com/yorrany/tiktok-video-downloader/archive/refs/heads/main.zip"
    UNPACK_TMP="/tmp/tikflow-unpack"
    rm -rf "$UNPACK_TMP"
    mkdir -p "$UNPACK_TMP"
    unzip -q -o "$TMP_ZIP" -d "$UNPACK_TMP"
    if [ -d "$UNPACK_TMP/tiktok-video-downloader-main/dist" ]; then
        cp -r "$UNPACK_TMP/tiktok-video-downloader-main/dist/"* "$INSTALL_DIR/"
    fi
fi

if [ -f "$TMP_ZIP" ] && [ ! -d "$UNPACK_TMP" ]; then
    unzip -q -o "$TMP_ZIP" -d "$INSTALL_DIR"
    rm -f "$TMP_ZIP"
fi

if command -v wl-copy &>/dev/null; then
    echo -n "$INSTALL_DIR" | wl-copy 2>/dev/null || true
elif command -v xclip &>/dev/null; then
    echo -n "$INSTALL_DIR" | xclip -selection clipboard 2>/dev/null || true
fi

echo -e "\n${GREEN}${BOLD}✓ Extensão extraída e pronta!${NC}"
echo -e "📁 Local da extensão: ${CYAN}${BOLD}${INSTALL_DIR}${NC}\n"

echo -e "${YELLOW}${BOLD}Último passo no seu Google Chrome:${NC}"
echo -e " 1. Abra o Chrome e acesse: ${CYAN}chrome://extensions${NC}"
echo -e " 2. Ative o ${BOLD}'Modo do desenvolvedor'${NC} (canto superior direito)."
echo -e " 3. Clique em ${BOLD}'Carregar sem compactação'${NC} (Load unpacked)."
echo -e " 4. Selecione a pasta: ${CYAN}${INSTALL_DIR}${NC}"
echo "---------------------------------------------------------"

if command -v google-chrome &>/dev/null || command -v google-chrome-stable &>/dev/null; then
    echo -e "${GREEN}Abrindo extensões do Chrome...${NC}"
    (google-chrome "chrome://extensions" &>/dev/null || google-chrome-stable "chrome://extensions" &>/dev/null) &
fi

echo -e "${GREEN}${BOLD}Pronto! Aproveite o TikFlow para baixar vídeos sem marca d'água livremente!${NC}\n"
