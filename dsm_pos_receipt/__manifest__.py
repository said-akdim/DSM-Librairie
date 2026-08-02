{
    'name': 'DSM - Ticket de caisse simplifié',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Ticket POS : titre seul (sans catégorie/auteur) et remises regroupées sur une seule ligne',
    'description': """
Personnalisation du ticket de caisse DSM Librairie :

1. Le nom du produit imprimé sur le ticket ne garde que le titre :
   la partie finale entre parenthèses (catégorie, éditeur, auteur,
   attributs de variante) est retirée.
   Ex. « LE ROBERT JUNIOR POCHE PLUS (LE ROBERT, Michael Wooldridge) »
   devient « LE ROBERT JUNIOR POCHE PLUS ».

2. Les lignes de remise (produit « Remise » du bouton Remise du POS)
   sont regroupées en une seule ligne « REMISE  -XXX,XX DH » en fin de
   ticket, sans le détail « 1,00 x -XXX,XX DH / Unité(s) ».

Uniquement l'impression du ticket est modifiée : l'écran de caisse,
les commandes et la comptabilité (TVA) restent inchangés.
    """,
    'author': 'DSM Librairie',
    'depends': ['point_of_sale'],
    'assets': {
        'point_of_sale._assets_pos': [
            'dsm_pos_receipt/static/src/**/*',
        ],
    },
    'installable': True,
    'license': 'LGPL-3',
}
