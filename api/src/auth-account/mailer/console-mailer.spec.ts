import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ConsoleMailer } from './console-mailer';

/**
 * Le stub `Mailer` de dev ne fait qu'**écrire** le lien dans les logs (aucune
 * délivrabilité réelle — TEM est en prod, hors lot 1.2). On vérifie qu'il
 * journalise le destinataire et le lien, sans lever.
 */
describe('ConsoleMailer (stub dev du port Mailer)', () => {
  it('journalise le lien de vérification (destinataire + lien)', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const mailer = new ConsoleMailer();

    await mailer.sendEmailVerification({
      to: 'alice@hpt.test',
      link: 'https://x/verify?token=abc',
    });

    expect(spy).toHaveBeenCalledOnce();
    const logged = String(spy.mock.calls[0][0]);
    expect(logged).toContain('alice@hpt.test');
    expect(logged).toContain('token=abc');
    spy.mockRestore();
  });

  it('journalise le lien de réinitialisation', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const mailer = new ConsoleMailer();

    await mailer.sendPasswordReset({ to: 'bob@hpt.test', link: 'https://x/reset?token=xyz' });

    const logged = String(spy.mock.calls[0][0]);
    expect(logged).toContain('bob@hpt.test');
    expect(logged).toContain('token=xyz');
    spy.mockRestore();
  });
});
