// Fluxo principal no browser: registo → assistente inicial → alerta de IUC no dashboard → sair → entrar.
import { test, expect } from '@playwright/test';

test('registo, primeiro veículo com lembretes, logout e login', async ({ page }) => {
  const email = `e2e-${Date.now()}@exemplo.pt`;
  const password = 'Segura-12345';
  // Matrícula deste mês (há 11 anos): o IUC vence no fim deste mês → aparece um alerta
  const now = new Date();
  const registrationDate = `${now.getUTCFullYear() - 11}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

  await page.goto('/register');
  await page.getByLabel('Nome').fill('Teste E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmar palavra-passe').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();

  // Assistente inicial
  const wizard = page.getByRole('dialog');
  await expect(wizard.getByText(/Passo 1 de 3/)).toBeVisible();
  await wizard.getByLabel('Qual é a matrícula?').fill('12AB34');
  await wizard.getByLabel('Marca').fill('Renault');
  await wizard.getByLabel('Modelo').fill('Clio');
  await wizard.getByLabel('Ano').fill(String(now.getUTCFullYear() - 11));
  await wizard.getByLabel('Quilómetros').fill('120000');
  await wizard.getByLabel('Data da matrícula').fill(registrationDate);
  await wizard.getByRole('button', { name: 'Continuar' }).click();
  // Passo 2: os prazos vêm sugeridos a partir da data da matrícula
  await expect(wizard.getByLabel('IUC até')).not.toHaveValue('');
  await wizard.getByRole('button', { name: 'Continuar' }).click();
  await wizard.getByRole('button', { name: 'Concluir' }).click();
  await expect(wizard.getByText('Está tudo pronto!')).toBeVisible();
  await wizard.getByRole('button', { name: 'Ver o meu dashboard' }).click();

  // O dashboard mostra o prazo do IUC como algo que precisa de atenção
  await expect(page.getByText(/IUC/).first()).toBeVisible();
  await expect(page.getByText(/Renault Clio/).first()).toBeVisible();

  // A sessão sobrevive a um recarregamento (refresh por cookie httpOnly)
  await page.reload();
  await expect(page.getByText(/Renault Clio/).first()).toBeVisible();

  // Sair e voltar a entrar
  await page.getByRole('button', { name: 'Terminar sessão' }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText(/Renault Clio/).first()).toBeVisible();
});

test('página inicial e páginas legais acessíveis sem conta', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const path of ['/privacidade', '/termos']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});
