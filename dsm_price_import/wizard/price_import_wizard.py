import base64
import csv
import io
import json

from odoo import models, fields, _
from odoo.exceptions import UserError

TAILLE_LOT = 500


class PriceImportWizard(models.TransientModel):
    _name = 'dsm.price.import.wizard'
    _description = 'Assistant mise à jour des prix de vente par fichier CSV/Excel'

    state = fields.Selection(
        [('draft', 'Fichier'), ('preview', 'Vérification'), ('done', 'Terminé')],
        default='draft', readonly=True,
    )
    data_file = fields.Binary('Fichier CSV ou Excel', attachment=False)
    data_filename = fields.Char()

    nb_lues = fields.Integer('Lignes valides lues', readonly=True)
    nb_trouves = fields.Integer('Produits trouvés', readonly=True)
    nb_a_modifier = fields.Integer('Prix à modifier', readonly=True)
    nb_inchanges = fields.Integer('Prix déjà à jour', readonly=True)
    nb_introuvables = fields.Integer('Codes-barres introuvables', readonly=True)
    introuvables = fields.Text('Détail des introuvables', readonly=True)
    apercu = fields.Text('Aperçu des changements', readonly=True)
    resultat = fields.Text('Résultat', readonly=True)

    payload = fields.Text(readonly=True)  # JSON [[template_id, nouveau_prix], ...]

    # ── Lecture du fichier ──────────────────────────────────────────────

    @staticmethod
    def _parser_lignes(lignes_brutes):
        """[(code, prix)] dédupliqué depuis des lignes de cellules texte.

        Tolérant : avec ou sans en-tête, colonnes vides intermédiaires,
        virgule décimale, code lu comme nombre (9782070368228.0).
        """
        entrees, vus, ignorees = [], set(), 0
        for ligne in lignes_brutes:
            cellules = [str(c).strip() for c in ligne if c is not None and str(c).strip()]
            if len(cellules) < 2:
                ignorees += bool(cellules)
                continue
            code, brut = cellules[0], cellules[-1]
            if code.endswith('.0'):
                code = code[:-2]
            try:
                prix = float(brut.replace('\xa0', '').replace(' ', '').replace(',', '.'))
            except ValueError:
                ignorees += 1  # en-tête ou ligne invalide
                continue
            if not code.isdigit() or prix <= 0 or code in vus:
                ignorees += code not in vus
                continue
            vus.add(code)
            entrees.append((code, prix))
        return entrees, ignorees

    def _lire_fichier(self):
        contenu = base64.b64decode(self.data_file)
        nom = (self.data_filename or '').lower()

        if nom.endswith(('.xlsx', '.xlsm')) or contenu[:4] == b'PK\x03\x04':
            try:
                import openpyxl
            except ImportError:
                raise UserError(_(
                    "La bibliothèque openpyxl est requise pour les fichiers Excel.\n"
                    "Installez-la avec : pip install openpyxl\n"
                    "Ou enregistrez votre fichier au format CSV."
                ))
            try:
                wb = openpyxl.load_workbook(io.BytesIO(contenu), read_only=True, data_only=True)
            except Exception as exc:
                raise UserError(_("Impossible de lire le fichier Excel : %s") % exc)
            lignes = list(wb.active.iter_rows(values_only=True))
            wb.close()
            return lignes

        try:
            texte = contenu.decode('utf-8-sig')
        except UnicodeDecodeError:
            texte = contenu.decode('latin-1')
        premiere = texte.splitlines()[0] if texte.splitlines() else ''
        separateur = max((';', ',', '\t'), key=premiere.count)
        return list(csv.reader(texte.splitlines(), delimiter=separateur))

    # ── Étape 1 : analyse (aucune modification) ─────────────────────────

    def action_analyser(self):
        self.ensure_one()
        if not self.data_file:
            raise UserError(_('Choisissez d’abord un fichier.'))

        entrees, _ignorees = self._parser_lignes(self._lire_fichier())
        if not entrees:
            raise UserError(_(
                'Aucune ligne exploitable dans le fichier.\n'
                'Format attendu : code-barres ; prix de vente'
            ))

        codes = [c for c, _p in entrees]
        modele_par_code = {}
        for debut in range(0, len(codes), TAILLE_LOT):
            variantes = self.env['product.product'].search(
                [('barcode', 'in', codes[debut:debut + TAILLE_LOT])]
            )
            for v in variantes:
                modele_par_code.setdefault(v.barcode, v.product_tmpl_id)

        changements, apercu, introuvables = [], [], []
        nb_inchanges = 0
        for code, prix in entrees:
            modele = modele_par_code.get(code)
            if not modele:
                introuvables.append(code)
                continue
            prix = round(prix, 2)
            if abs(modele.list_price - prix) < 0.005:
                nb_inchanges += 1
                continue
            changements.append((modele.id, prix))
            if len(apercu) < 30:
                apercu.append('%s | %s : %.2f → %.2f' % (
                    code, modele.name[:50], modele.list_price, prix))

        texte_introuvables = '\n'.join(introuvables[:100])
        if len(introuvables) > 100:
            texte_introuvables += _('\n… et %s autres') % (len(introuvables) - 100)
        texte_apercu = '\n'.join(apercu)
        if len(changements) > len(apercu):
            texte_apercu += _('\n… et %s autres changements') % (len(changements) - len(apercu))

        self.write({
            'state': 'preview',
            'nb_lues': len(entrees),
            'nb_trouves': len(entrees) - len(introuvables),
            'nb_a_modifier': len(changements),
            'nb_inchanges': nb_inchanges,
            'nb_introuvables': len(introuvables),
            'introuvables': texte_introuvables,
            'apercu': texte_apercu,
            'payload': json.dumps(changements),
        })
        return self._reouvrir()

    # ── Étape 2 : application ───────────────────────────────────────────

    def action_appliquer(self):
        self.ensure_one()
        changements = json.loads(self.payload or '[]')
        if not changements:
            raise UserError(_('Rien à appliquer.'))

        par_prix = {}
        for template_id, prix in changements:
            par_prix.setdefault(prix, []).append(template_id)

        total = 0
        for prix, ids in par_prix.items():
            for debut in range(0, len(ids), TAILLE_LOT):
                lot = ids[debut:debut + TAILLE_LOT]
                self.env['product.template'].browse(lot).write({'list_price': prix})
                total += len(lot)

        self.write({
            'state': 'done',
            'resultat': _('%s prix de vente mis à jour.') % total,
        })
        return self._reouvrir()

    def action_recommencer(self):
        self.ensure_one()
        self.write({'state': 'draft', 'data_file': False, 'payload': False})
        return self._reouvrir()

    def _reouvrir(self):
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }
