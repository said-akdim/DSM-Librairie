{
    'name': 'DSM - Commandes Fournitures Scolaires',
    'version': '18.0.1.0.0',
    'category': 'Purchase',
    'summary': 'Import Excel EAN13 par école → pré-bons de commande fournisseurs',
    'description': """
Workflow :
1. Créer une session (année scolaire)
2. Importer un fichier Excel : EAN13 | École | Qté N-1
3. Le module calcule automatiquement : Qté estimée = Qté N-1 – Stock actuel
4. Lignes groupées par fournisseur, quantités ajustables
5. Génération des bons de commande en brouillon par fournisseur
    """,
    'author': 'DSM Librairie',
    'depends': ['purchase', 'stock', 'sale'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/import_excel_wizard_views.xml',
        'views/school_supply_session_views.xml',
        'views/menu.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
