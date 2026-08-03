{
    'name': 'DSM - Remise globale POS',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Remise globale en % sur toute la commande POS, sans ligne de remise, TVA native',
    'description': """
Remise globale pour le Point de Vente DSM Librairie :

- Un bouton « Remise globale » dans l'écran de vente demande un pourcentage
  et l'applique sur toutes les lignes de la commande via le champ remise (%)
  natif d'Odoo. Aucune ligne « Remise » n'est créée : la TVA est recalculée
  par le cœur d'Odoo, ligne par ligne, sans aucun calcul personnalisé.
- Saisir 0 retire la remise globale.
- Sur le ticket : les produits sont imprimés au prix normal (avant remise),
  puis une seule ligne « REMISE GLOBALE (X%)  -XXX,XX DH » apparaît juste
  avant les totaux. Les totaux et la TVA imprimés sont ceux, corrects,
  après remise.

Compatible avec le module dsm_pos_receipt (nettoyage des titres).
    """,
    'author': 'DSM Librairie',
    'depends': ['point_of_sale'],
    'assets': {
        'point_of_sale._assets_pos': [
            'dsm_pos_global_discount/static/src/**/*',
        ],
    },
    'installable': True,
    'license': 'LGPL-3',
}
