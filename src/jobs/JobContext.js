// ============================================================
// Global inceleme isi takibi. Is arka planda surer; kullanici
// hangi ekranda olursa olsun polling burada yurur. jobId kalici
// (AsyncStorage) — uygulama kapanip acilsa bile devam eden is bulunur.
// Bitince: gecmise ekle + kota artir + bildirim gonder.
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startAuditJob, pollAuditJobOnce, registerPushToken } from '../api/client';
import { addToHistory } from '../storage/history';
import { incrementMonthlyUsage } from '../storage/usage';
import { registerForPush } from '../notifications';
import { t } from '../i18n';

const ACTIVE_KEY = 'audittrove:activeJob';
const POLL_MS = 4000;

const JobContext = createContext(null);

export function useJob() {
  return useContext(JobContext);
}

export function JobProvider({ children }) {
  const [activeJob, setActiveJob] = useState(null); // {id, fileName, docType, status, startedAt}
  const [completedJob, setCompletedJob] = useState(null); // {id, result, fileName, docType}
  const [failedJob, setFailedJob] = useState(null); // {fileName, error}

  const activeRef = useRef(null);
  activeRef.current = activeJob;
  const pollTimer = useRef(null);
  const busy = useRef(false); // ust uste sorgu onleme

  const persist = useCallback(async (job) => {
    try {
      if (job && job.id) await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(job));
      else await AsyncStorage.removeItem(ACTIVE_KEY);
    } catch (e) {
      // sessiz
    }
  }, []);

  const finishDone = useCallback(
    async (job, result) => {
      try { await addToHistory({ fileName: job.fileName, result, docType: job.docType }); } catch (e) {}
      try { await incrementMonthlyUsage(); } catch (e) {}
      await persist(null);
      setActiveJob(null);
      setCompletedJob({ id: job.id, result, fileName: job.fileName, docType: job.docType });
      // Bildirim artik backend'den push ile gelir (uygulama kapali/arka planda olsa da).
    },
    [persist]
  );

  const finishFailed = useCallback(
    async (job, error) => {
      await persist(null);
      setActiveJob(null);
      setFailedJob({ fileName: job.fileName, error: error || t('cli.serverError') });
    },
    [persist]
  );

  const pollOnce = useCallback(async () => {
    const job = activeRef.current;
    if (!job || !job.id || busy.current) return;
    busy.current = true;
    try {
      const res = await pollAuditJobOnce(job.id);
      if (!res) return;
      if (res.status === 'DONE') {
        if (res.result) await finishDone(job, res.result);
        else await finishFailed(job, t('cli.serverError'));
      } else if (res.status === 'FAILED') {
        await finishFailed(job, res.error);
      } else if (res.status === 'GONE') {
        // TTL ile silindi ya da bulunamadi
        await finishFailed(job, t('cli.timeout'));
      }
      // PENDING / PROCESSING → beklemeye devam
    } catch (e) {
      // gecici hata → sonraki tur
    } finally {
      busy.current = false;
    }
  }, [finishDone, finishFailed]);

  // Aktif is varken polling dongusu
  const activeId = activeJob && activeJob.id;
  useEffect(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    if (activeId) {
      pollOnce();
      pollTimer.current = setInterval(pollOnce, POLL_MS);
    }
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [activeId, pollOnce]);

  // Uygulama on plana donunce hemen sorgula (arka planda kacirilmis sonucu yakala)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') pollOnce();
    });
    return () => sub.remove();
  }, [pollOnce]);

  // Acilista devam eden isi yukle
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_KEY);
        if (raw) {
          const job = JSON.parse(raw);
          if (job && job.id) setActiveJob(job);
        }
      } catch (e) {
        // sessiz
      }
    })();
  }, []);

  // Isi baslat: hemen "starting" goster, arka planda jobId al
  const startJob = useCallback(
    async (file, docType) => {
      // Push izni al + token'i backend'e kaydet (is bitince backend bu token'a push atar)
      registerForPush()
        .then((tok) => { if (tok) registerPushToken(tok); })
        .catch(() => {});
      const provisional = {
        id: null,
        fileName: file.name || 'document.pdf',
        docType,
        status: 'starting',
        startedAt: Date.now(),
      };
      setActiveJob(provisional);
      try {
        const { id } = await startAuditJob(file, docType);
        const job = { ...provisional, id, status: 'processing' };
        await persist(job);
        setActiveJob(job);
        return { ok: true };
      } catch (e) {
        await persist(null);
        setActiveJob(null);
        return { ok: false, error: e, code: e && e.code };
      }
    },
    [persist]
  );

  const consumeCompleted = useCallback(() => {
    const c = completedJob;
    setCompletedJob(null);
    return c;
  }, [completedJob]);

  const clearFailed = useCallback(() => setFailedJob(null), []);

  const value = {
    activeJob,
    completedJob,
    failedJob,
    startJob,
    consumeCompleted,
    clearFailed,
  };

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}