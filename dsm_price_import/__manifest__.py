{
    'name': 'DSM - Mise à jour des prix de vente',
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': 'Import CSV/Excel → mise à jour en masse des prix de vente par code-barres',
    'description': """
Workflow :
1. Ventes → Mise à jour des prix
2. Charger un fichier CSV ou Excel : code-barres (EAN13) | prix de vente
3. Analyse : rapport complet (trouvés, introuvables, prix inchangés) — rien n'est modifié
4. Bouton « Appliquer » : écriture des nouveaux prix de vente (list_price)
    """,
    'author': 'DSM Librairie',
    'depends': ['sale', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/price_import_wizard_views.xml',
    ],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
