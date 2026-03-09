import { useEffect, useMemo, useState } from 'react';
import { getJson } from '../../api.js';
import { formatRelativeTime } from '../../utils/reviewCommentFormat.js';
import {
  statusBadgeGraded,
  statusBadgePending,
  statusBadgeSubmitted
} from './stylesReview.js';

export default function useReviewMetaState({ revisionId, canMetaReview, submissionId }) {
  const [reviewInfo, setReviewInfo] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [metaReview, setMetaReview] = useState({ nota: '', observacion: '' });
  const [metaReviewInfo, setMetaReviewInfo] = useState(null);
  const [metaReviewLoading, setMetaReviewLoading] = useState(false);
  const [metaReviewSaving, setMetaReviewSaving] = useState(false);
  const [metaReviewError, setMetaReviewError] = useState('');
  const [metaReviewSuccess, setMetaReviewSuccess] = useState('');

  const resetMetaReviewState = () => {
    setMetaReview({ nota: '', observacion: '' });
    setMetaReviewInfo(null);
    setMetaReviewLoading(false);
    setMetaReviewSaving(false);
    setMetaReviewError('');
    setMetaReviewSuccess('');
  };

  useEffect(() => {
    if (!revisionId) {
      setReviewInfo(null);
      setReviewLoading(false);
      resetMetaReviewState();
      return;
    }

    if (!canMetaReview) {
      resetMetaReviewState();
      return;
    }

    setMetaReviewError('');
    setMetaReviewSuccess('');
  }, [revisionId, canMetaReview]);

  useEffect(() => {
    if (!revisionId || !canMetaReview) {
      return;
    }

    let active = true;
    const loadMetaReview = async () => {
      try {
        setMetaReviewLoading(true);
        setMetaReviewError('');
        const data = await getJson(`/reviews/${revisionId}/meta`);
        if (!active) return;
        const meta = data?.meta || null;
        setMetaReviewInfo(meta);
        setMetaReview({
          nota: meta?.nota_final ?? '',
          observacion: meta?.observacion ?? ''
        });
      } catch (err) {
        if (!active) return;
        setMetaReviewInfo(null);
        setMetaReviewError(err.message);
      } finally {
        if (active) {
          setMetaReviewLoading(false);
        }
      }
    };

    loadMetaReview();

    return () => {
      active = false;
    };
  }, [revisionId, canMetaReview]);

  useEffect(() => {
    if (!revisionId || !submissionId) {
      setReviewInfo(null);
      setReviewLoading(false);
      return;
    }

    let active = true;

    const loadReviewInfo = async () => {
      try {
        setReviewLoading(true);
        const list = await getJson(`/reviews?submissionId=${submissionId}`);
        if (!active) return;
        const matched = Array.isArray(list)
          ? list.find((item) => Number(item.id) === Number(revisionId))
          : null;
        setReviewInfo(matched || null);
      } catch (_err) {
        if (!active) return;
        setReviewInfo(null);
      } finally {
        if (active) {
          setReviewLoading(false);
        }
      }
    };

    loadReviewInfo();

    return () => {
      active = false;
    };
  }, [revisionId, submissionId]);

  const reviewStatus = useMemo(() => {
    if (!reviewInfo?.fecha_envio) {
      return { label: 'Pendiente', style: statusBadgePending };
    }
    if (reviewInfo.nota_numerica !== null && reviewInfo.nota_numerica !== undefined) {
      return { label: 'Con nota', style: statusBadgeGraded };
    }
    return { label: 'Enviada', style: statusBadgeSubmitted };
  }, [reviewInfo]);

  const submittedTime = useMemo(
    () => formatRelativeTime(reviewInfo?.fecha_envio),
    [reviewInfo?.fecha_envio]
  );

  const metaSavedTime = useMemo(
    () => formatRelativeTime(metaReviewInfo?.fecha_registro),
    [metaReviewInfo?.fecha_registro]
  );

  return {
    reviewInfo,
    reviewLoading,
    metaReview,
    metaReviewInfo,
    metaReviewLoading,
    metaReviewSaving,
    metaReviewError,
    metaReviewSuccess,
    reviewStatus,
    submittedTime,
    metaSavedTime,
    setMetaReview,
    setMetaReviewInfo,
    setMetaReviewSaving,
    setMetaReviewError,
    setMetaReviewSuccess,
    resetMetaReviewState
  };
}

