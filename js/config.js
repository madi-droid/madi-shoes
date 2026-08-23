// js/config.js — Supabase & Application Environment Configuration

(function () {
  'use strict';

  const CONFIG_STORAGE_KEY = 'madi_shoes_env';

  // Environment Settings (Dev & Prod Supabase Projects)
  const ENV_CONFIGS = {
    Dev: {
      url: 'https://srilbinsjkiefurhmmkd.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyaWxiaW5zamtpZWZ1cmhtbWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwOTE3MTEsImV4cCI6MjEwMTY2NzcxMX0.6ZSBMczJk7a3FKDijoqrgsqB2hHfMoFQTaB5Oh_Cf9c',
      name: 'Madiyar-Shoes-Dev'
    },
    Prod: {
      url: 'https://srilbinsjkiefurhmmkd.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyaWxiaW5zamtpZWZ1cmhtbWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwOTE3MTEsImV4cCI6MjEwMTY2NzcxMX0.6ZSBMczJk7a3FKDijoqrgsqB2hHfMoFQTaB5Oh_Cf9c',
      name: 'Madiyar-Shoes-Prod'
    }
  };

  let currentEnv = localStorage.getItem(CONFIG_STORAGE_KEY) || 'Dev';
  if (!ENV_CONFIGS[currentEnv]) {
    currentEnv = 'Dev';
  }

  let supabaseClientInstance = null;

  function getActiveConfig() {
    return ENV_CONFIGS[currentEnv];
  }

  function isConfigured() {
    const cfg = getActiveConfig();
    return cfg.url && cfg.anonKey &&
      !cfg.url.includes('YOUR_') &&
      !cfg.anonKey.includes('YOUR_') &&
      cfg.url.startsWith('http');
  }

  function setEnvironment(envName) {
    if (ENV_CONFIGS[envName]) {
      currentEnv = envName;
      localStorage.setItem(CONFIG_STORAGE_KEY, envName);
      supabaseClientInstance = null;
      window.location.reload();
    }
  }

  function getSupabaseClient() {
    if (supabaseClientInstance) {
      return supabaseClientInstance;
    }

    if (!isConfigured()) {
      return null;
    }

    const activeConfig = getActiveConfig();
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabaseClientInstance = window.supabase.createClient(activeConfig.url, activeConfig.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
        return supabaseClientInstance;
      } catch (e) {
        console.warn('Ошибка инициализации Supabase SDK:', e);
        return null;
      }
    } else {
      console.warn('Supabase JS SDK CDN не загружен.');
      return null;
    }
  }

  window.AppConfig = {
    get currentEnv() {
      return currentEnv;
    },
    ENV_CONFIGS,
    getActiveConfig,
    isConfigured,
    setEnvironment,
    getSupabaseClient
  };

})();
