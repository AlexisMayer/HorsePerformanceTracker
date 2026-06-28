import type { SéanceCréerDto, SéanceSortie } from '@hpt/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../auth/api-client';
import type { SessionsApi } from './sessions-api';
import { isTransientError, submitSession } from './submit';

const DTO: SéanceCréerDto = {
  type: 'Parcours',
  idempotency_key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  provenance: 'live',
  obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 0, refus: 0 }],
};

const SAVED = { id: 's1' } as SéanceSortie;

/** API factice : `create` programmable, `delay` immédiat (pas d'attente réelle). */
function fakeApi(create: SessionsApi['create']): SessionsApi {
  return { create, listForHorse: vi.fn(), get: vi.fn(), update: vi.fn(), remove: vi.fn() };
}
const noDelay = () => Promise.resolve();

describe('isTransientError', () => {
  it('réseau (TypeError) et 5xx/408/429 sont transitoires', () => {
    expect(isTransientError(new TypeError('Network request failed'))).toBe(true);
    expect(isTransientError(new ApiError(500, 'x'))).toBe(true);
    expect(isTransientError(new ApiError(503, 'x'))).toBe(true);
    expect(isTransientError(new ApiError(429, 'x'))).toBe(true);
    expect(isTransientError(new ApiError(408, 'x'))).toBe(true);
  });

  it('400 / 401 / 404 sont définitifs (non réessayés)', () => {
    expect(isTransientError(new ApiError(400, 'x'))).toBe(false);
    expect(isTransientError(new ApiError(401, 'x'))).toBe(false);
    expect(isTransientError(new ApiError(404, 'x'))).toBe(false);
  });
});

describe('submitSession', () => {
  it('réussit du premier coup → un seul appel', async () => {
    const create = vi.fn().mockResolvedValue(SAVED);
    const result = await submitSession(fakeApi(create), 'h1', DTO, { delay: noDelay });
    expect(result).toBe(SAVED);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('coupure passagère puis succès : réessaie avec la MÊME clé d’idempotence', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockRejectedValueOnce(new ApiError(503, 'indispo'))
      .mockResolvedValue(SAVED);
    const onRetry = vi.fn();

    const result = await submitSession(fakeApi(create), 'h1', DTO, { delay: noDelay, onRetry });

    expect(result).toBe(SAVED);
    expect(create).toHaveBeenCalledTimes(3);
    // Chaque tentative envoie le même DTO → même idempotency_key → pas de doublon.
    for (const call of create.mock.calls) {
      expect(call[0]).toBe('h1');
      expect((call[1] as SéanceCréerDto).idempotency_key).toBe(DTO.idempotency_key);
    }
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('erreur définitive (400) : ne réessaie pas', async () => {
    const create = vi.fn().mockRejectedValue(new ApiError(400, 'invalide'));
    await expect(submitSession(fakeApi(create), 'h1', DTO, { delay: noDelay })).rejects.toThrow(
      ApiError,
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('réessais épuisés : lève la dernière erreur après retries+1 tentatives', async () => {
    const create = vi.fn().mockRejectedValue(new TypeError('offline'));
    await expect(
      submitSession(fakeApi(create), 'h1', DTO, { retries: 2, delay: noDelay }),
    ).rejects.toThrow(TypeError);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('attente exponentielle entre les réessais', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('x'))
      .mockRejectedValueOnce(new TypeError('x'))
      .mockResolvedValue(SAVED);
    const delays: number[] = [];
    await submitSession(fakeApi(create), 'h1', DTO, {
      baseDelayMs: 100,
      delay: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    expect(delays).toEqual([100, 200]);
  });
});
