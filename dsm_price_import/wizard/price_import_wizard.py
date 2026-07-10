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

    rapport_file = fields.Binary('Rapport (CSV)', readonly=True, attachment=False)
    rapport_filename = fields.Char(readonly=True)

    # JSON [[code, nom, ancien_prix, nouveau_prix, statut, template_id], ...]
    # statut : a_modifier | deja_a_jour | introuvable
    payload = fields.Text(readonly=True)

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

        detail, apercu, introuvables = [], [], []
        nb_a_modifier = nb_inchanges = 0
        for code, prix in entrees:
            modele = modele_par_code.get(code)
            prix = round(prix, 2)
            if not modele:
                introuvables.append(code)
                detail.append([code, '', 0.0, prix, 'introuvable', 0])
            elif abs(modele.list_price - prix) < 0.005:
                nb_inchanges += 1
                detail.append([code, modele.name, modele.list_price, prix,
                               'deja_a_jour', modele.id])
            else:
                nb_a_modifier += 1
                detail.append([code, modele.name, modele.list_price, prix,
                               'a_modifier', modele.id])
                if len(apercu) < 30:
                    apercu.append('%s | %s : %.2f → %.2f' % (
                        code, modele.name[:50], modele.list_price, prix))

        texte_introuvables = '\n'.join(introuvables[:100])
        if len(introuvables) > 100:
            texte_introuvables += _('\n… et %s autres') % (len(introuvables) - 100)
        texte_apercu = '\n'.join(apercu)
        if nb_a_modifier > len(apercu):
            texte_apercu += _('\n… et %s autres changements') % (nb_a_modifier - len(apercu))

        self.write({
            'state': 'preview',
            'nb_lues': len(entrees),
            'nb_trouves': len(entrees) - len(introuvables),
            'nb_a_modifier': nb_a_modifier,
            'nb_inchanges': nb_inchanges,
            'nb_introuvables': len(introuvables),
            'introuvables': texte_introuvables,
            'apercu': texte_apercu,
            'payload': json.dumps(detail),
        })
        return self._reouvrir()

    # ── Étape 2 : application ───────────────────────────────────────────

    def action_appliquer(self):
        self.ensure_one()
        detail = json.loads(self.payload or '[]')
        par_prix = {}
        for code, nom, ancien, nouveau, statut, template_id in detail:
            if statut == 'a_modifier':
                par_prix.setdefault(nouveau, []).append(template_id)
        if not par_prix:
            raise UserError(_('Rien à appliquer : aucun prix à modifier.'))

        total = 0
        for prix, ids in par_prix.items():
            for debut in range(0, len(ids), TAILLE_LOT):
                lot = ids[debut:debut + TAILLE_LOT]
                self.env['product.template'].browse(lot).write({'list_price': prix})
                total += len(lot)

        self.write({
            'state': 'done',
            'resultat': _(
                '%(maj)s prix de vente mis à jour.\n'
                '%(inchanges)s articles déjà à jour (prix identique).\n'
                '%(introuvables)s codes-barres introuvables dans Odoo.\n\n'
                'Téléchargez le rapport détaillé ci-dessous.',
                maj=total,
                inchanges=self.nb_inchanges,
                introuvables=self.nb_introuvables,
            ),
            'rapport_file': self._generer_rapport(detail),
            'rapport_filename': 'rapport_prix_%s.csv' % fields.Date.today(),
        })
        return self._reouvrir()

    @staticmethod
    def _generer_rapport(detail):
        """Rapport CSV : un article par ligne avec son statut final."""
        libelles = {
            'a_modifier': 'Mis à jour',
            'deja_a_jour': 'Déjà à jour',
            'introuvable': 'Introuvable dans Odoo',
        }
        tampon = io.StringIO()
        rapport = csv.writer(tampon, delimiter=';')
        rapport.writerow(['code_barres', 'article', 'ancien_prix',
                          'nouveau_prix', 'statut'])
        for code, nom, ancien, nouveau, statut, _template_id in detail:
            rapport.writerow([
                code, nom,
                ('%.2f' % ancien).replace('.', ',') if statut != 'introuvable' else '',
                ('%.2f' % nouveau).replace('.', ','),
                libelles.get(statut, statut),
            ])
        # utf-8-sig pour que Excel affiche correctement les accents
        return base64.b64encode(tampon.getvalue().encode('utf-8-sig'))

    def action_recommencer(self):
        self.ensure_one()
        self.write({'state': 'draft', 'data_file': False, 'payload': False,
                    'rapport_file': False})
        return self._reouvrir()

    def _reouvrir(self):
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }
