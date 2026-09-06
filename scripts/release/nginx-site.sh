#!/usr/bin/env bash
# PD-SAAS-FORK: 共享 Nginx 站点部署（HTTP 缓存 / 阿里云 HTTPS / Let's Encrypt）
# shellcheck shell=bash

apply_nova_nginx_cache_assets() {
  local base="${1:-/opt/nova-ai-studio/current}"
  mkdir -p /var/cache/nginx/nova
  chown -R nginx:nginx /var/cache/nginx/nova 2>/dev/null || chown -R www-data:www-data /var/cache/nginx/nova 2>/dev/null || true
  if [[ -f "$base/nginx-cache-http.conf" ]]; then
    cp -f "$base/nginx-cache-http.conf" /etc/nginx/conf.d/00-nova-cache-http.conf
  fi
  if [[ -f "$base/nginx-nova-locations.conf" ]]; then
    cp -f "$base/nginx-nova-locations.conf" /etc/nginx/nova-locations.conf
  fi
}

apply_nova_nginx_site() {
  local install_root="${1:-/opt/nova-ai-studio}"
  local release_dir="${2:-$install_root/current}"
  local env_file="${3:-$install_root/.env}"
  local https_env="$install_root/https-aliyun.env"
  local nginx_conf="/etc/nginx/conf.d/nova-ai-studio.conf"

  local deploy_domain=""
  if [[ -f "$env_file" ]]; then
    deploy_domain="$(grep -E '^DEPLOY_DOMAIN=' "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
  fi
  if [[ -z "$deploy_domain" || "$deploy_domain" == "_" ]]; then
    return 0
  fi

  apply_nova_nginx_cache_assets "$release_dir"

  if [[ -f "$https_env" ]]; then
    # shellcheck disable=SC1090
    source "$https_env"
    if [[ "${HTTPS_MODE:-}" == "aliyun" && -n "${SSL_CERT:-}" && -n "${SSL_KEY:-}" && -f "$SSL_CERT" && -f "$SSL_KEY" ]]; then
      local server_names="${DEPLOY_DOMAIN:-$deploy_domain}"
      if [[ -n "${DEPLOY_APEX:-}" && "$DEPLOY_APEX" != "$server_names" ]]; then
        server_names="$server_names $DEPLOY_APEX"
      fi
      local template="$release_dir/nginx-https-aliyun.conf"
      [[ -f "$template" ]] || template="$(dirname "$0")/../../deploy/nginx-https-aliyun.conf"
      sed -e "s/DEPLOY_SERVER_NAMES_PLACEHOLDER/$server_names/g" \
        -e "s|SSL_CERT_PATH_PLACEHOLDER|$SSL_CERT|g" \
        -e "s|SSL_KEY_PATH_PLACEHOLDER|$SSL_KEY|g" \
        "$template" > "$nginx_conf"
      echo "[nova] Nginx: 已应用阿里云 HTTPS（$server_names）"
      rm -rf /var/cache/nginx/nova/* 2>/dev/null || true
      nginx -t && systemctl reload nginx
      return 0
    fi
  fi

  local le_cert="/etc/letsencrypt/live/$deploy_domain/fullchain.pem"
  if [[ -f "$le_cert" ]]; then
    local server_names="$deploy_domain"
    local template="$release_dir/nginx-https.conf.cached"
    [[ -f "$template" ]] || template="$release_dir/nginx-https.conf"
    sed "s/DEPLOY_DOMAIN_PLACEHOLDER/$deploy_domain/g; s/DEPLOY_SERVER_NAMES_PLACEHOLDER/$server_names/g" "$template" > "$nginx_conf"
    echo "[nova] Nginx: 已保留 Let's Encrypt HTTPS"
    rm -rf /var/cache/nginx/nova/* 2>/dev/null || true
    nginx -t && systemctl reload nginx
    return 0
  fi

  local http_template="$release_dir/nginx.conf.cached"
  [[ -f "$http_template" ]] || http_template="$release_dir/nginx.conf"
  sed "s/DEPLOY_DOMAIN_PLACEHOLDER/$deploy_domain/g" "$http_template" > "$nginx_conf"
  echo "[nova] Nginx: HTTP（未检测到 https-aliyun.env 或 LE 证书；HTTPS 请运行 setup-https-aliyun.sh）"
  rm -rf /var/cache/nginx/nova/* 2>/dev/null || true
  nginx -t && systemctl reload nginx
}
